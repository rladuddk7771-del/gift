document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('giftForm');
  const submitBtn = document.getElementById('submitBtn');
  const loading = document.getElementById('loading');
  const resultContainer = document.getElementById('resultContainer');
  const errorMessage = document.getElementById('errorMessage');

  // 결과 표시 요소들
  const gift1Name = document.getElementById('gift1Name');
  const gift1Reason = document.getElementById('gift1Reason');
  const gift1Sense = document.getElementById('gift1Sense');
  const gift1Link = document.getElementById('gift1Link');

  const gift2Name = document.getElementById('gift2Name');
  const gift2Reason = document.getElementById('gift2Reason');
  const gift2Sense = document.getElementById('gift2Sense');
  const gift2Link = document.getElementById('gift2Link');

  const reviewsSummary = document.getElementById('reviewsSummary');
  const cardMessage = document.getElementById('cardMessage');
  const tipsContent = document.getElementById('tipsContent');

  // 복사 버튼들
  const copyMsgBtn = document.getElementById('copyMsgBtn');
  const copyAllBtn = document.getElementById('copyAllBtn');

  // 폼 제출 이벤트 처리
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const recipient = document.getElementById('recipient').value.trim();
    const budget = document.getElementById('budget').value.trim();
    const occasion = document.getElementById('occasion').value.trim();
    const interests = document.getElementById('interests').value.trim();

    // 프론트엔드 유효성 검사
    if (!recipient || !budget || !occasion || !interests) {
      showError('모든 항목을 입력해 주세요!');
      return;
    }

    // UI 상태 초기화: 에러 숨김, 이전 결과 숨김, 로딩 시작
    hideError();
    resultContainer.style.display = 'none';
    loading.style.display = 'block';
    submitBtn.disabled = true;
    submitBtn.textContent = '큐레이션 분석 중...';

    try {
      const response = await fetch('/recommend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          recipient,
          budget,
          occasion,
          interests
        })
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || '추천을 불러오는 중 오류가 발생했습니다.');
      }

      // 추천 데이터 화면에 채우기
      const result = data.data;
      gift1Name.textContent = result.gift1?.name || '추천 아이템 01';
      gift1Reason.textContent = result.gift1?.reason || '';
      gift1Sense.textContent = result.gift1?.sense_point || '';
      if (result.gift1?.shopping_url) {
        gift1Link.href = result.gift1.shopping_url;
        gift1Link.style.display = 'inline-flex';
      } else {
        gift1Link.style.display = 'none';
      }

      gift2Name.textContent = result.gift2?.name || '추천 아이템 02';
      gift2Reason.textContent = result.gift2?.reason || '';
      gift2Sense.textContent = result.gift2?.sense_point || '';
      if (result.gift2?.shopping_url) {
        gift2Link.href = result.gift2.shopping_url;
        gift2Link.style.display = 'inline-flex';
      } else {
        gift2Link.style.display = 'none';
      }

      reviewsSummary.textContent = result.reviews_summary || '후기 정보가 없습니다.';
      cardMessage.textContent = result.card_message || '';
      tipsContent.textContent = result.tips || '';

      // 결과 화면 표시 및 부드러운 스크롤 이동
      resultContainer.style.display = 'block';
      resultContainer.scrollIntoView({ behavior: 'smooth' });

    } catch (err) {
      showError(err.message);
    } finally {
      loading.style.display = 'none';
      submitBtn.disabled = false;
      submitBtn.textContent = '선물 큐레이션 분석';
    }
  });

  // 에러 메시지 표시/숨김 헬퍼 함수
  function showError(msg) {
    errorMessage.textContent = msg;
    errorMessage.style.display = 'block';
  }

  function hideError() {
    errorMessage.textContent = '';
    errorMessage.style.display = 'none';
  }

  // 1초 완성 카드 문구 복사 기능
  copyMsgBtn.addEventListener('click', async () => {
    const text = cardMessage.textContent;
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      const originalText = copyMsgBtn.textContent;
      copyMsgBtn.textContent = '복사 완료';
      setTimeout(() => {
        copyMsgBtn.textContent = originalText;
      }, 2000);
    } catch {
      alert('문구 복사에 실패했습니다.');
    }
  });

  // 전체 추천 결과 텍스트 복사 기능
  copyAllBtn.addEventListener('click', async () => {
    const textToCopy = `[ GIFT CURATION ARCHIVE ]

01. ${gift1Name.textContent}
- 선정 배경: ${gift1Reason.textContent}
- 큐레이터 포인트: ${gift1Sense.textContent}
- 구매처: ${gift1Link.href}

02. ${gift2Name.textContent}
- 선정 배경: ${gift2Reason.textContent}
- 큐레이터 포인트: ${gift2Sense.textContent}
- 구매처: ${gift2Link.href}

[ 실사용자 리뷰 분석 ]
${reviewsSummary.textContent}

[ 메시지 카드 제안 ]
${cardMessage.textContent}

[ 선물 가이드 & 유의사항 ]
${tipsContent.textContent}
`;

    try {
      await navigator.clipboard.writeText(textToCopy);
      const originalText = copyAllBtn.textContent;
      copyAllBtn.textContent = '복사 완료';
      setTimeout(() => {
        copyAllBtn.textContent = originalText;
      }, 2000);
    } catch {
      alert('전체 복사에 실패했습니다.');
    }
  });

  // ----------------- PWA 기능: 서비스 워커 등록 및 설치 버튼 -----------------
  const installPwaBtn = document.getElementById('installPwaBtn');
  let deferredPrompt;

  // 브라우저에서 앱 설치 가능한 경우 설치 버튼 노출
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (installPwaBtn) {
      installPwaBtn.style.display = 'inline-flex';
    }
  });

  if (installPwaBtn) {
    installPwaBtn.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log('[PWA] 사용자 응답:', outcome);
      deferredPrompt = null;
      installPwaBtn.style.display = 'none';
    });
  }

  const iosGuide = document.getElementById('iosInstallGuide');
  const isIos = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
  const isInStandalone = ('standalone' in window.navigator) && window.navigator.standalone;

  // iOS Safari 환경이면서 아직 홈 화면에 설치되지 않은 경우 친절한 안내 배너 노출
  if (isIos && !isInStandalone && iosGuide) {
    iosGuide.style.display = 'block';
  }
});

// PWA 서비스 워커 등록
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then((reg) => {
        console.log('[PWA] Service Worker 등록 성공, Scope:', reg.scope);
      })
      .catch((err) => {
        console.warn('[PWA] Service Worker 등록 실패:', err);
      });
  });
}
