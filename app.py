import json
import os
import re
import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, render_template, request, send_from_directory
from google import genai

# .env 환경변수 로드
load_dotenv()

app = Flask(__name__)

# 설정된 모델명 (지정 규격: gemini-3.5-flash-lite)
DEFAULT_MODEL = "gemini-3.5-flash-lite"
FALLBACK_MODEL = "gemini-2.0-flash"


def search_serper(query, api_key):
    """Serper.dev API를 호출하여 실시간 웹 검색 결과를 가져옵니다."""
    url = "https://google.serper.dev/search"
    headers = {
        "X-API-KEY": api_key,
        "Content-Type": "application/json"
    }
    payload = {
        "q": query,
        "gl": "kr",
        "hl": "ko",
        "num": 5
    }

    try:
        response = requests.post(url, headers=headers, json=payload, timeout=10)
        if response.status_code == 200:
            data = response.json()
            organic_results = data.get("organic", [])
            snippets = []
            for item in organic_results:
                title = item.get("title", "")
                snippet = item.get("snippet", "")
                if snippet:
                    snippets.append(f"- {title}: {snippet}")
            return "\n".join(snippets)
        else:
            return f"검색 결과 조회 실패 (상태 코드: {response.status_code})"
    except Exception as e:
        return f"검색 중 오류 발생: {str(e)}"


@app.route("/")
def index():
    """메인 페이지를 렌더링합니다."""
    return render_template("index.html")


@app.route("/manifest.json")
def manifest():
    """PWA 매니페스트 파일 제공"""
    return send_from_directory("static", "manifest.json", mimetype="application/manifest+json")


@app.route("/service-worker.js")
def service_worker():
    """PWA 서비스 워커 파일 제공 (루트 스코프 설정)"""
    response = send_from_directory("static", "service-worker.js", mimetype="application/javascript")
    response.headers["Service-Worker-Allowed"] = "/"
    return response


@app.route("/recommend", methods=["POST"])
def recommend():
    """선물 추천 요청을 처리하는 API 엔드포인트"""
    gemini_api_key = os.getenv("GEMINI_API_KEY")
    serper_api_key = os.getenv("SERPER_API_KEY")

    if not gemini_api_key or gemini_api_key.startswith("여기에_"):
        return jsonify({"error": "GEMINI_API_KEY가 .env 파일에 올바르게 설정되지 않았습니다."}), 500

    if not serper_api_key or serper_api_key.startswith("여기에_"):
        return jsonify({"error": "SERPER_API_KEY가 .env 파일에 올바르게 설정되지 않았습니다."}), 500

    data = request.get_json() or {}
    recipient = data.get("recipient", "").strip()
    budget = data.get("budget", "").strip()
    occasion = data.get("occasion", "").strip()
    interests = data.get("interests", "").strip()

    # 입력값 유효성 검증
    if not recipient or not budget or not occasion or not interests:
        return jsonify({"error": "모든 입력 항목(받는 사람, 예산, 상황, 취향)을 입력해 주세요."}), 400

    # 1. Serper 검색어로 최신 선물 후기 수집
    search_query = f"{recipient} {occasion} {budget} {interests} 선물 추천 후기"
    search_snippets = search_serper(search_query, serper_api_key)

    # 2. Gemini 프롬프트 구성
    system_instruction = (
        "당신은 센스 넘치는 선물 큐레이터이자 카피라이터입니다. "
        "사용자의 조건과 검색된 실사용자 후기 정보를 종합하여, 가장 감동적이고 센스 있는 선물 2가지와 카드 문구, 팁을 추천해 주세요. "
        "반드시 지정된 JSON 형식으로만 응답해야 하며 마크다운 코드블록(```json 등) 없이 순수 JSON 문자열만 출력하세요."
    )

    prompt = f"""
[사용자 입력 정보]
- 받는 사람: {recipient}
- 예산 범위: {budget}
- 선물 목적/상황: {occasion}
- 취향/특징: {interests}

[실시간 웹 검색 후기 데이터 (Serper)]
{search_snippets}

[출력 요구사항]
다음 JSON 키 규격을 정확히 지켜 한국어로 응답하세요:
{{
  "gift1": {{
    "name": "추천 선물 1위 제품명",
    "reason": "구체적인 선정 이유",
    "sense_point": "이 선물이 센스 있는 결정적 포인트"
  }},
  "gift2": {{
    "name": "추천 선물 2위 대안 아이템",
    "reason": "대안으로 추천하는 이유",
    "sense_point": "차별화된 센스 포인트"
  }},
  "reviews_summary": "Serper 검색 후기를 바탕으로 한 실제 만족도 및 핵심 반응 요약 (2~3문장)",
  "card_message": "상황과 상대방에게 어울리는 1초 완성 감동 카드 문구",
  "tips": "선물 전달 팁 및 호불호 방지를 위한 주의사항"
}}
"""

    # 3. Gemini API 호출
    try:
        client = genai.Client(api_key=gemini_api_key)
        
        # 모델 호출 시도 (요구 모델 -> 예외 시 fallback)
        target_model = os.getenv("GEMINI_MODEL", DEFAULT_MODEL)
        try:
            response = client.models.generate_content(
                model=target_model,
                contents=prompt,
                config={
                    "system_instruction": system_instruction,
                    "response_mime_type": "application/json"
                }
            )
        except Exception as model_err:
            # 지정된 모델명이 지원되지 않을 경우 호환 모델로 대체 호출
            response = client.models.generate_content(
                model=FALLBACK_MODEL,
                contents=prompt,
                config={
                    "system_instruction": system_instruction,
                    "response_mime_type": "application/json"
                }
            )

        response_text = response.text.strip()

        # JSON 파싱 (코드블록 포맷이 섞였을 경우 정리)
        if response_text.startswith("```"):
            response_text = re.sub(r"^```(?:json)?\s*", "", response_text)
            response_text = re.sub(r"\s*```$", "", response_text)

        result_json = json.loads(response_text)

        # 각 추천 선물에 최저가/구매처 바로가기 링크(네이버 쇼핑) 자동 추가
        import urllib.parse
        g1_name = result_json.get("gift1", {}).get("name", "")
        g2_name = result_json.get("gift2", {}).get("name", "")
        if g1_name:
            result_json["gift1"]["shopping_url"] = f"https://search.shopping.naver.com/search/all?query={urllib.parse.quote(g1_name)}"
        if g2_name:
            result_json["gift2"]["shopping_url"] = f"https://search.shopping.naver.com/search/all?query={urllib.parse.quote(g2_name)}"

        return jsonify({"success": True, "data": result_json})

    except json.JSONDecodeError:
        return jsonify({
            "error": "AI 응답 형식을 처리하지 못했습니다. 다시 시도해 주세요.",
            "raw": response_text
        }), 500
    except Exception as e:
        return jsonify({"error": f"추천 생성 중 오류 발생: {str(e)}"}), 500


if __name__ == "__main__":
    # 같은 와이파이의 모바일/외부 기기 접속 허용 및 맥북 AirPlay 충돌 방지
    app.run(debug=True, host="0.0.0.0", port=5001)
