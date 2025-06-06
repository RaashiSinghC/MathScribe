from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from apps.calculator.route import router as calculator_router
from constants import SERVER_URL, PORT, ENV

try:
    import google.generativeai as genai
    if hasattr(genai, "configure"):
        genai.configure(api_key="AIzaSyAb3q51x6xYCgnmds9wJV6xhTWNiaMDdzk")  # Use the provided API key
    else:
        raise AttributeError("The 'genai' library does not support the 'configure' method.")
except ImportError:
    genai = None
    print("Warning: 'genai' library is not installed. Some features may not work.")
except AttributeError as e:
    print(f"Error: {str(e)}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield

app = FastAPI(lifespan=lifespan)


app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],  # Ensure this allows requests from the frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get('/')
async def root():
    return {
        "message": "MathScribe Server is running",
        "app_name": "MathScribe",
        "developer": "Raashi and Sandy"
    }

app.include_router(calculator_router)  # Remove prefix and tags for global endpoints


if __name__ == "__main__":
    uvicorn.run("main:app", host=SERVER_URL, port=int(PORT), reload=(ENV == "dev"))