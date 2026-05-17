import os
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv
import google.generativeai as genai
import httpx

# 加载环境变量
load_dotenv()

app = FastAPI()

# 配置 Google Gemini API
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel('gemini-pro') # 或者 'gemini-1.5-flash' 等
else:
    model = None
    print("Warning: GEMINI_API_KEY not found. AI analysis will be limited.")

class ProductAnalyzeRequest(BaseModel):
    url: str
    prompt: str
    category: str

@app.post("/api/analyze-product")
async def analyze_product(request_data: ProductAnalyzeRequest):
    if not model:
        raise HTTPException(status_code=503, detail="AI service not configured. Please set GEMINI_API_KEY.")

    try:
        # 尝试使用 AI 模型进行分析
        # 注意：这里直接使用前端提供的 prompt，实际应用中可能需要后端构建更安全的 prompt
        response = model.generate_content(request_data.prompt)
        
        # 提取 AI 响应中的 JSON 字符串
        ai_text = response.text.strip()
        import re
        json_match = re.search(r'\{.*\}', ai_text, re.DOTALL)
        if not json_match:
            raise ValueError("AI response did not contain valid JSON.")
        
        result = json.loads(json_match.group(0))
        
        return JSONResponse(content={"result": result})

    except Exception as e:
        print(f"AI analysis failed: {e}")
        # 如果 AI 分析失败，可以考虑在这里实现一个更复杂的 fallback 逻辑
        # 例如，调用一个更简单的本地解析函数，或者返回一个通用错误信息
        raise HTTPException(status_code=500, detail=f"AI analysis failed: {e}")

# 简单的根路由，用于测试服务是否运行
@app.get("/")
async def read_root():
    return {"message": "AI Product Analysis Backend is running!"}

# 注意：为了在生产环境中运行，您需要使用 Uvicorn 或 Gunicorn 等 ASGI 服务器
# 例如：uvicorn main:app --host 0.0.0.0 --port 8000
