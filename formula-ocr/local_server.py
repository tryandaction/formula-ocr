#!/usr/bin/env python3
"""
Local LaTeX OCR Server using Ollama
Provides a REST API for formula recognition using local vision models.

Usage:
    1. Install Ollama: https://ollama.ai
    2. Pull a vision model: ollama pull llama3.2-vision
    3. pip install flask flask-cors requests
    4. python local_server.py

The server will start on http://localhost:8502
"""

import base64
import requests
import json
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Ollama configuration
OLLAMA_URL = "http://localhost:11434"
# 支持的视觉模型，按优先级排序
# 注意：TinyLlama 和 Mistral 基础版不支持图片，需要使用视觉模型
VISION_MODELS = [
    "llama3.2-vision",   # Meta 最新视觉模型，推荐
    "llava",             # 经典视觉模型
    "llava:13b",         # LLaVA 13B 版本
    "llava:7b",          # LLaVA 7B 版本
    "bakllava",          # BakLLaVA
    "minicpm-v",         # MiniCPM-V 小型视觉模型
    "moondream",         # Moondream 轻量视觉模型
]

def get_available_model():
    """检查 Ollama 中可用的视觉模型"""
    try:
        response = requests.get(f"{OLLAMA_URL}/api/tags", timeout=5)
        if response.ok:
            models = response.json().get("models", [])
            model_names = [m["name"].split(":")[0] for m in models]
            
            # 查找第一个可用的视觉模型
            for vm in VISION_MODELS:
                base_name = vm.split(":")[0]
                if base_name in model_names:
                    # 返回完整的模型名
                    for m in models:
                        if m["name"].startswith(base_name):
                            return m["name"]
            return None
    except:
        return None

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    try:
        response = requests.get(f"{OLLAMA_URL}/api/tags", timeout=3)
        if response.ok:
            model = get_available_model()
            if model:
                return jsonify({
                    'status': 'ok',
                    'service': 'ollama-vision',
                    'model': model,
                    'version': '1.0.0'
                })
            else:
                return jsonify({
                    'status': 'no_model',
                    'error': '未找到视觉模型，请运行: ollama pull llama3.2-vision',
                    'available_models': VISION_MODELS
                }), 503
        return jsonify({'status': 'error', 'error': 'Ollama 响应异常'}), 503
    except requests.exceptions.ConnectionError:
        return jsonify({
            'status': 'error',
            'error': 'Ollama 未运行，请先启动 Ollama'
        }), 503
    except Exception as e:
        return jsonify({'status': 'error', 'error': str(e)}), 503

@app.route('/recognize', methods=['POST'])
def recognize():
    """
    Recognize LaTeX from image using Ollama vision model
    """
    try:
        data = request.get_json()
        
        if not data or 'image' not in data:
            return jsonify({
                'error': 'Missing image data',
                'success': False
            }), 400
        
        # 获取可用模型
        model = get_available_model()
        if not model:
            return jsonify({
                'error': '未找到视觉模型，请运行: ollama pull llama3.2-vision',
                'success': False
            }), 503
        
        # 准备 Ollama 请求
        image_base64 = data['image']
        
        prompt = """Look at this image of a mathematical formula or equation.
Extract the formula and convert it to LaTeX code.

Rules:
1. Output ONLY the LaTeX code, nothing else
2. Do NOT include $$ or $ delimiters
3. Do NOT include any explanation or text
4. If there are multiple formulas, separate them with newlines

Example output format:
E = mc^2
\\frac{a}{b} = c"""

        # 调用 Ollama API
        print(f"[INFO] Starting recognition with model: {model}")
        response = requests.post(
            f"{OLLAMA_URL}/api/generate",
            json={
                "model": model,
                "prompt": prompt,
                "images": [image_base64],
                "stream": False,
                "options": {
                    "temperature": 0.1,  # 低温度以获得更确定的输出
                    "num_predict": 256,  # 减少输出长度加快速度
                    "num_ctx": 2048      # 减少上下文窗口
                }
            },
            timeout=180  # 3分钟超时，视觉模型在CPU上很慢
        )
        print(f"[INFO] Recognition completed")
        
        if not response.ok:
            return jsonify({
                'error': f'Ollama 错误: {response.status_code}',
                'success': False
            }), 500
        
        result = response.json()
        latex = result.get("response", "").strip()
        
        # 清理输出
        latex = clean_latex_output(latex)
        
        if not latex:
            return jsonify({
                'error': '无法识别公式',
                'success': False
            }), 400
        
        return jsonify({
            'latex': latex,
            'success': True,
            'model': model
        })
        
    except requests.exceptions.Timeout:
        return jsonify({
            'error': '识别超时，请重试',
            'success': False
        }), 504
    except Exception as e:
        return jsonify({
            'error': str(e),
            'success': False
        }), 500

def clean_latex_output(text):
    """清理模型输出，提取纯 LaTeX"""
    if not text:
        return ""
    
    # 移除常见的包装
    text = text.strip()
    
    # 移除 markdown 代码块
    if text.startswith("```"):
        lines = text.split("\n")
        # 移除第一行和最后一行的 ```
        lines = [l for l in lines if not l.strip().startswith("```")]
        text = "\n".join(lines)
    
    # 移除 $$ 或 $ 包装
    if text.startswith("$$") and text.endswith("$$"):
        text = text[2:-2]
    elif text.startswith("$") and text.endswith("$"):
        text = text[1:-1]
    
    # 移除 \[ \] 包装
    if text.startswith("\\[") and text.endswith("\\]"):
        text = text[2:-2]
    
    return text.strip()

@app.route('/info', methods=['GET'])
def info():
    """Get server information"""
    model = get_available_model()
    return jsonify({
        'name': 'Ollama Vision Server',
        'description': 'Local LaTeX OCR using Ollama vision models',
        'current_model': model,
        'supported_models': VISION_MODELS,
        'endpoints': {
            '/health': 'Health check',
            '/recognize': 'POST - Recognize LaTeX from image',
            '/info': 'Server information'
        },
        'features': [
            'Offline recognition',
            'No API key required',
            'Privacy-preserving',
            'Uses local Ollama models'
        ]
    })

if __name__ == '__main__':
    print("=" * 50)
    print("Ollama Vision Server for Formula OCR")
    print("=" * 50)
    print(f"\nOllama URL: {OLLAMA_URL}")
    print(f"Supported models: {', '.join(VISION_MODELS)}")
    print("\nStarting server on http://localhost:8502")
    print("Press Ctrl+C to stop\n")
    
    # 检查 Ollama 状态
    model = get_available_model()
    if model:
        print(f"✓ Found vision model: {model}")
    else:
        print("⚠ No vision model found!")
        print("  Run: ollama pull llama3.2-vision")
    
    print()
    app.run(host='0.0.0.0', port=8502, debug=False)
