import os
import uvicorn
from fastapi import FastAPI
from langfuse import Langfuse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from langchain_core.messages import SystemMessage, HumanMessage, AIMessageChunk
from config.config import RequestObject
from MarketInsight.components.agent import agent
from MarketInsight.utils.logger import get_logger
from MarketInsight.utils import storage

logger = get_logger(__name__)
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

langfuse = Langfuse(
    public_key=os.getenv("LANGFUSE_PUBLIC_KEY"),
    secret_key=os.getenv("LANGFUSE_SECRET_KEY"),
    host=os.getenv("LANGFUSE_HOST")
)

storage.init_db()


@app.get("/health")
async def health_check():
    """Health check endpoint for service monitoring and keep-alive pings"""
    return {"status": "ok", "message": "Service is running"}


@app.get("/api/threads")
async def list_threads():
    return storage.get_threads()


@app.get("/api/threads/{thread_id}/messages")
async def thread_messages(thread_id: str):
    return storage.get_thread_messages(thread_id)


@app.post("/api/chat")
async def chat(request: RequestObject):

    config = {
        "configurable": {
            "thread_id": request.threadId
        }
    }

    storage.ensure_thread(request.threadId, request.prompt.content[:50])
    storage.save_message(request.threadId, "user", request.prompt.content)

    async def generate():

        try:
            with langfuse.start_as_current_observation(
                as_type="span",
                name="chat-request",
                input=request.prompt.content,
            ) as span:

                span.update(
                    metadata={
                        "user_id": request.threadId
                    }
                )

                with langfuse.start_as_current_observation(
                    as_type="generation",
                    name="agent-stream",
                    model="agentic-workflow",
                    input=request.prompt.content,
                ) as generation:

                    full_response = ""

                    messages = [
                        SystemMessage(
                            content=("""
                                You are Market Insight, a professional financial market analysis agent.

                            You have access to tools that provide stock prices, historical data,
                            financial statements, company information, dividends, institutional
                            holdings, insider transactions, analyst recommendations, stock news,
                            and ticker resolution.

                            IMPORTANT RULES:

                            1. If the user asks about current, latest, today's, recent, real-time,
                            or market-related information, you MUST use the appropriate tool.

                            2. Never say that you do not have access to financial data when a
                            relevant tool is available.

                            3. If the user gives a company name but not a ticker, use the ticker
                            resolution tool first.

                            4. Use tool results as the source of truth for financial data.

                            5. Never invent stock prices, financial figures, market movements,
                            news, or other financial information.

                            6. You may use your general knowledge only for conceptual questions
                            where no tool is required.

                            7. After receiving tool results, explain the result clearly and
                            concisely to the user."""
                            )
                        ),
                        HumanMessage(
                            content=request.prompt.content
                        ),
                    ]

                    for token, metadata in agent.stream(
                        {
                            "messages": messages
                        },
                        stream_mode="messages",
                        config=config,
                    ):

                        # Only stream the model's own output, not tool call/result chunks
                        if not isinstance(token, AIMessageChunk):
                            continue

                        content = token.content

                        if not content:
                            continue

                        # Some providers can return structured content
                        if isinstance(content, list):
                            text = ""

                            for item in content:
                                if isinstance(item, dict):
                                    text += item.get("text", "")
                                elif isinstance(item, str):
                                    text += item

                            content = text

                        if not content:
                            continue

                        full_response += content

                        yield content

                    generation.update(
                        output=full_response
                    )

                    storage.save_message(request.threadId, "assistant", full_response)

                span.update(
                    output="Request completed successfully"
                )

        except Exception as e:

            logger.exception(
                f"Error in chat: {e}"
            )

            # Send a readable error to the client
            yield (
                "\n\nSorry, something went wrong while "
                "processing your request."
            )

    return StreamingResponse(
        generate(),
        media_type="text/plain",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )

if __name__ == '__main__':
    logger.info("App Initiated Successfully")
    uvicorn.run(app, host='0.0.0.0', port=8000)