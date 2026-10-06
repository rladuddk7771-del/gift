import json
import os
import re
import urllib.parse
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

# 카테고리별 고품질 감성 플레이스홀더 이미지 (절대 깨지지 않는 고화질 Unsplash)
CATEGORY_IMAGES = {
    "beauty": "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=800&q=80",
    "living": "https://images.unsplash.com/photo-1603006905003-be475563bc59?auto=format&fit=crop&w=800&q=80",
    "food": "https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=800&q=80",
    "tech": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80",
    "fashion": "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=800&q=80",
    "relax": "https://images.unsplash.com/photo-1544441893-675973e31985?auto=format&fit=crop&w=800&q=80",
    "general": "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=800&q=80"
}


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
        response = requests.post(url, headers=headers, json=payload, timeout=8)
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


def search_serper_image(product_name, api_key):
    """Serper Images API를 통해 실제 상품의 대표 이미지를 검색합니다."""
    url = "https://google.serper.dev/images"
    headers = {
        "X-API-KEY": api_key,
        "Content-Type": "application/json"
    }
    payload = {
        "q": f"{product_name} 제품",
        "gl": "kr",
        "hl": "ko",
        "num": 3
    }
    try:
        res = requests.post(url, headers=headers, json=payload, timeout=6)
        if res.status_code == 200:
            images = res.json().get("images", [])
            for img in images:
                img_url = img.get("imageUrl", "")
                if img_url and img_url.startswith("http") and not img_url.endswith(".svg"):
                    return img_url
    except Exception:
        pass
    return None


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
    """상용 서비스 수준의 3열 그리드 맞춤 선물 큐레이션 API"""
    gemini_api_key = os.getenv("GEMINI_API_KEY")
    serper_api_key = os.getenv("SERPER_API_KEY")

    if not gemini_api_key or gemini_api_key.startswith("여기에_"):
        return jsonify({"error": "GEMINI_API_KEY가 .env 파일에 올바르게 설정되지 않았습니다."}), 500

    if not serper_api_key or serper_api_key.startswith("여기에_"):
        return jsonify({"error": "SERPER_API_KEY가 .env 파일에 올바르게 설정되지 않았습니다."}), 500
    data = request.get_json() or {}
    recipient = (data.get("recipient") or data.get("target") or "").strip()
    budget = (data.get("budget") or "").strip()
    occasion = (data.get("occasion") or data.get("reason") or "").strip()
    interests = (data.get("interests") or "").strip()

    # 입력값 유효성 검증
    if not recipient or not budget or not occasion or not interests:
        return jsonify({"error": "모든 입력 항목(받는 사람, 예산, 상황, 취향)을 입력해 주세요."}), 400

    # 1. Serper 검색어로 최신 선물 트렌드/후기 수집
    search_query = f"{recipient} {occasion} {budget} {interests} 선물 추천 후기"
    search_snippets = search_serper(search_query, serper_api_key)

    # 2. Gemini 프롬프트 구성 (3개 큐레이션 상품 그리드 + 감성 요약)
    system_instruction = (
        "당신은 2030 세대를 위한 하이엔드 라이프스타일 선물 큐레이터이자 수석 카피라이터입니다. "
        "사용자의 조건(대상, 예산, 상황, 취향)과 실사용자 후기를 종합 분석하여, "
        "서로 다른 매력을 가진 최고 수준의 센스 만점 선물 3가지를 엄선해 주세요. "
        "반드시 순수 JSON 문자열만 출력하세요 (마크다운 코드블록 금지)."
    )

    prompt = f"""
[사용자 입력 정보]
- 받는 대상: {recipient}
- 예산 범위: {budget}
- 선물 목적/상황: {occasion}
- 취향/특징: {interests}

[실시간 웹 검색 후기 데이터 (Serper)]
{search_snippets}

[출력 요구사항]
다음 JSON 규격을 정확히 지켜 한국어로 응답하세요:
{{
  "summary": "사용자의 조건에 맞춤 선별한 1~2문장의 세련된 큐레이션 인트로 (예: 20대 친구를 위한 3~5만원대 감성 생일 선물 컬렉션입니다.)",
  "gifts": [
    {{
      "name": "1순위 추천 브랜드 및 구체적 제품명",
      "price": "예상 가격대 (예: ₩38,000)",
      "category": "beauty | living | food | tech | fashion | relax | general 중 1개",
      "reason": "마음을 울리는 한 줄 추천 이유",
      "sense_point": "이 선물이 센스 있는 결정적 이유 (1문장)",
      "tags": ["#감성적", "#생일선물", "#20대추천"]
    }},
    {{
      "name": "2순위 대안 추천 브랜드 및 제품명",
      "price": "예상 가격대 (예: ₩45,000)",
      "category": "beauty | living | food | tech | fashion | relax | general 중 1개",
      "reason": "차별화된 매력의 추천 이유",
      "sense_point": "실용성과 디자인을 모두 잡은 포인트",
      "tags": ["#실용적", "#인테리어", "#기분전환"]
    }},
    {{
      "name": "3순위 유니크/가성비 추천 브랜드 및 제품명",
      "price": "예상 가격대 (예: ₩29,000)",
      "category": "beauty | living | food | tech | fashion | relax | general 중 1개",
      "reason": "부담 없이 확실한 감동을 주는 추천 이유",
      "sense_point": "호불호 없이 만족도가 높은 비결",
      "tags": ["#가성비", "#데일리", "#특별한순간"]
    }}
  ],
  "reviews_summary": "실제 후기 및 만족도 핵심 요약 (2문장)",
  "card_message": "상황에 꼭 맞는 정성 어린 1초 완성 축하/감사 메시지",
  "tips": "선물 전달 시 센스를 극대화하는 팁 및 주의사항"
}}
"""

    # 3. Gemini API 호출
    try:
        client = genai.Client(api_key=gemini_api_key)
        
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
        except Exception:
            response = client.models.generate_content(
                model=FALLBACK_MODEL,
                contents=prompt,
                config={
                    "system_instruction": system_instruction,
                    "response_mime_type": "application/json"
                }
            )

        response_text = response.text.strip()

        if response_text.startswith("```"):
            response_text = re.sub(r"^```(?:json)?\s*", "", response_text)
            response_text = re.sub(r"\s*```$", "", response_text)

        result_json = json.loads(response_text)
        gifts_list = result_json.get("gifts", [])

        # 각 상품별 이미지 매핑 및 최저가 링크 생성
        for idx, gift in enumerate(gifts_list):
            gift["id"] = f"gift-{idx + 1}"
            g_name = gift.get("name", "")
            g_cat = gift.get("category", "general")

            # 1순위: Serper 실시간 상품 이미지 검색
            img_url = search_serper_image(g_name, serper_api_key)
            if not img_url:
                # 2순위: 카테고리별 고해상도 Unsplash 감성 이미지 보장
                img_url = CATEGORY_IMAGES.get(g_cat, CATEGORY_IMAGES["general"])

            gift["image_url"] = img_url

            # 네이버 쇼핑 최저가 검색 링크
            if g_name:
                gift["shopping_url"] = f"https://search.shopping.naver.com/search/all?query={urllib.parse.quote(g_name)}"
            else:
                gift["shopping_url"] = "https://shopping.naver.com"

        # 이전 하위 호환성을 위한 gift1, gift2 alias 제공
        if len(gifts_list) > 0:
            result_json["gift1"] = gifts_list[0]
        if len(gifts_list) > 1:
            result_json["gift2"] = gifts_list[1]

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
