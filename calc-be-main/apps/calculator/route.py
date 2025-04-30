from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import base64
import io
from apps.calculator.utils import analyze_image
from schema import ImageData
from PIL import Image
import google.generativeai as genai
from constants import GEMINI_API_KEY

genai.configure(api_key=GEMINI_API_KEY)

router = APIRouter()

class CalculateRequest(BaseModel):
    image: str
    dict_of_vars: dict

@router.post("/calculate")
async def calculate(data: CalculateRequest):
    try:
        # Decode the image
        image_data = base64.b64decode(data.image.split(",")[1])
        image = Image.open(io.BytesIO(image_data))

        # Check if the image is blank
        if image.getbbox() is None:
            return {
                "data": [],
                "status": "error",
                "error": "The image is blank. Please provide a valid image with mathematical expressions."
            }

        # Analyze the image
        result = analyze_image(image, data.dict_of_vars)
        return {"data": result, "status": "success"}
    except Exception as e:
        print("Error in /calculate endpoint:", str(e))
        return {"data": [], "status": "error", "error": str(e)}

@router.post("/search")
async def search(payload: dict):
    try:
        query = payload.get("query", "")
        image_b64 = payload.get("image", None)

        if not genai:
            return {
                "result": "Gemini API is not configured. Please contact the administrator.",
                "status": "error"
            }

        model = genai.GenerativeModel(model_name="gemini-1.5-flash")
        system_prompt = (
            "You are MathScribe, an expert AI assistant for math, science, code, and drawing. "
            "You can answer questions, solve equations, explain concepts, and write code in any language. "
            "If the user asks you to edit the canvas (e.g., draw a shape, clear, write text), respond ONLY with a command in the format: "
            "__canvas_edit__:{...json...} (no explanation, just the command). "
            "For all other queries, answer as a helpful chatbot with explanations, code, or math as needed."
        )

        if image_b64:
            image_data = base64.b64decode(image_b64.split(",")[1])
            image = Image.open(io.BytesIO(image_data))
            response = model.generate_content([system_prompt, query, image])
        else:
            response = model.generate_content([system_prompt, query])

        # Log the raw response for debugging
        print("Gemini API raw response:", response)

        return {"result": response.text, "status": "success"}
    except Exception as e:
        print("Error in /search endpoint:", str(e))
        return {"result": f"Error: {str(e)}", "status": "error"}
