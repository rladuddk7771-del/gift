document.addEventListener('DOMContentLoaded', () => {
  // 폼 및 화면 영역
  const form = document.getElementById('giftForm');
  const formSection = document.getElementById('formSection');
  const submitBtn = document.getElementById('submitBtn');
  const loadingSection = document.getElementById('loadingSection');
  const loadingStatusText = document.getElementById('loadingStatusText');
  const loadingProgressFill = document.getElementById('loadingProgressFill');
  const resultContainer = document.getElementById('resultContainer');
  const errorMessage = document.getElementById('errorMessage');

  // 결과 영역 요소들
  const curatorSummary = document.getElementById('curatorSummary');
  const productGrid = document.getElementById('productGrid');
  const resultCountBadge = document.getElementById('resultCountBadge');
  const reviewsSummary = document.getElementById('reviewsSummary');
  const cardMessage = document.getElementById('cardMessage');
  const tipsContent = document.getElementById('tipsContent');

  // 툴바 버튼들
  const copyMsgBtn = document.getElementById('copyMsgBtn');
  const copyAllBtn = document.getElementById('copyAllBtn');
  const modifyConditionBtn = document.getElementById('modifyConditionBtn');
  const rerunBtn = document.getElementById('rerunBtn');

  // 위시리스트 드로어 요소들
  const savedWishlistBtn = document.getElementById('savedWishlistBtn');
  const wishlistDrawer = document.getElementById('wishlistDrawer');
  const closeWishlistBtn = document.getElementById('closeWishlistBtn');
  const drawerOverlay = document.getElementById('drawerOverlay');
  const wishlistItemsContainer = document.getElementById('wishlistItemsContainer');
  const savedCountBadge = document.getElementById('savedCountBadge');
  const drawerWishlistCount = document.getElementById('drawerWishlistCount');
  const copyWishlistBtn = document.getElementById('copyWishlistBtn');

  // 전역 상태
  let currentGifts = [];
  let currentRawData = null;
  let savedItems = JSON.parse(localStorage.getItem('gift_curator_saved_items') || '[]');

  // 기본 고화질 대체 이미지
  const FALLBACK_IMG = "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=800&q=80";

  // ----------------- 1. 필(Pill) 버튼 인터랙션 초기화 -----------------
  function initPillButtons() {
    // 단일 선택 필 (받는 대상, 예산, 목적)
    document.querySelectorAll('.pill-group:not(.multi-select)').forEach(group => {
      const inputName = group.getAttribute('data-input');
      const targetInput = document.getElementById(inputName);

      group.querySelectorAll('.pill').forEach(btn => {
        btn.addEventListener('click', () => {
          group.querySelectorAll('.pill').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const val = btn.getAttribute('data-value');

          if (inputName === 'recipient') {
            if (val === '기타') {
              targetInput.value = '';
              targetInput.focus();
            } else {
              targetInput.value = val;
            }
          } else if (targetInput) {
            targetInput.value = val;
          }
        });
      });
    });

    // 다중 선택 필 (취향)
    const interestsGroup = document.querySelector('.pill-group.multi-select');
    const interestsHidden = document.getElementById('interests');
    const interestsDetail = document.getElementById('interestsDetail');

    function updateInterestsValue() {
      const selected = Array.from(interestsGroup.querySelectorAll('.pill.active')).map(p => p.getAttribute('data-value'));
      const detail = interestsDetail.value.trim();
      let combined = selected.join(', ');
      if (detail) {
        combined += (combined ? ', ' : '') + detail;
      }
      interestsHidden.value = combined || '실용적인, 감성적인';
    }

    if (interestsGroup) {
      interestsGroup.querySelectorAll('.pill').forEach(btn => {
        btn.addEventListener('click', () => {
          btn.classList.toggle('active');
          updateInterestsValue();
        });
      });
    }

    if (interestsDetail) {
      interestsDetail.addEventListener('input', updateInterestsValue);
    }
  }

  initPillButtons();

  // ----------------- 2. 위시리스트 (하트 저장) 관리 -----------------
  function updateWishlistBadge() {
    const count = savedItems.length;
    if (savedCountBadge) savedCountBadge.textContent = count;
    if (drawerWishlistCount) drawerWishlistCount.textContent = count;
  }

  function isItemSaved(id) {
    return savedItems.some(item => item.id === id);
  }

  function toggleSaveItem(gift) {
    const existsIdx = savedItems.findIndex(item => item.id === gift.id || item.name === gift.name);
    if (existsIdx >= 0) {
      savedItems.splice(existsIdx, 1);
    } else {
      savedItems.push(gift);
    }
    localStorage.setItem('gift_curator_saved_items', JSON.stringify(savedItems));
    updateWishlistBadge();
    renderProductGrid(currentGifts);
    renderWishlistDrawer();
  }

  function renderWishlistDrawer() {
    if (!wishlistItemsContainer) return;
    if (savedItems.length === 0) {
      wishlistItemsContainer.innerHTML = `
        <div class="empty-wishlist">
          <p class="empty-title">저장된 선물이 없습니다.</p>
          <p class="empty-sub">추천 상품 카드 우측 상단의 하트(♡)를 눌러 마음에 드는 선물을 저장해 보세요.</p>
        </div>
      `;
      return;
    }

    wishlistItemsContainer.innerHTML = savedItems.map(item => `
      <div class="wishlist-item-card">
        <img src="${item.image_url || FALLBACK_IMG}" alt="${item.name}" onerror="this.src='${FALLBACK_IMG}'" class="wishlist-thumb">
        <div class="wishlist-info">
          <h4 class="wishlist-name">${item.name}</h4>
          <span class="wishlist-price">${item.price || ''}</span>
          <div class="wishlist-links">
            <a href="${item.shopping_url || '#'}" target="_blank" rel="noopener noreferrer" class="wishlist-buy-link">최저가 보기 ↗</a>
            <button type="button" class="wishlist-remove-btn" data-id="${item.id}">삭제</button>
          </div>
        </div>
      </div>
    `).join('');

    wishlistItemsContainer.querySelectorAll('.wishlist-remove-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        savedItems = savedItems.filter(i => i.id !== id);
        localStorage.setItem('gift_curator_saved_items', JSON.stringify(savedItems));
        updateWishlistBadge();
        renderProductGrid(currentGifts);
        renderWishlistDrawer();
      });
    });
  }

  // 드로어 토글
  if (savedWishlistBtn) {
    savedWishlistBtn.addEventListener('click', () => {
      renderWishlistDrawer();
      wishlistDrawer.classList.add('open');
      drawerOverlay.classList.add('open');
    });
  }

  function closeDrawer() {
    if (wishlistDrawer) wishlistDrawer.classList.remove('open');
    if (drawerOverlay) drawerOverlay.classList.remove('open');
  }

  if (closeWishlistBtn) closeWishlistBtn.addEventListener('click', closeDrawer);
  if (drawerOverlay) drawerOverlay.addEventListener('click', closeDrawer);

  if (copyWishlistBtn) {
    copyWishlistBtn.addEventListener('click', async () => {
      if (savedItems.length === 0) {
        alert('저장된 선물이 없습니다.');
        return;
      }
      const text = `[ THE GIFT CURATOR - MY WISHLIST ]\n\n` +
        savedItems.map((item, idx) => `${idx + 1}. ${item.name} (${item.price || ''})\n- 구매처: ${item.shopping_url || ''}`).join('\n\n');
      try {
        await navigator.clipboard.writeText(text);
        copyWishlistBtn.textContent = '위시리스트 복사 완료!';
        setTimeout(() => { copyWishlistBtn.textContent = '위시리스트 목록 복사'; }, 2000);
      } catch {
        alert('복사에 실패했습니다.');
      }
    });
  }

  updateWishlistBadge();

  // ----------------- 3. 3열 상품 카드 렌더링 -----------------
  function renderProductGrid(gifts) {
    if (!productGrid) return;
    if (!gifts || gifts.length === 0) {
      productGrid.innerHTML = '<p class="no-results">해당 조건에 맞는 추천 상품이 없습니다.</p>';
      return;
    }

    productGrid.innerHTML = gifts.map((gift, idx) => {
      const isSaved = isItemSaved(gift.id);
      const tagsHtml = (gift.tags || []).map(t => `<span class="tag-pill">${t}</span>`).join(' ');
      const rankBadge = idx === 0 ? '01 / BEST SELECTION' : (idx === 1 ? '02 / ALTERNATIVE' : '03 / CURATOR PICK');

      return `
        <article class="card product-card">
          <div class="product-image-wrap">
            <img src="${gift.image_url || FALLBACK_IMG}" alt="${gift.name}" onerror="this.src='${FALLBACK_IMG}'" class="product-img" loading="lazy">
            <button type="button" class="heart-save-btn ${isSaved ? 'saved' : ''}" data-id="${gift.id}" title="${isSaved ? '저장 취소' : '위시리스트에 저장'}">
              ${isSaved ? '♥' : '♡'}
            </button>
            <span class="product-rank-badge">${rankBadge}</span>
          </div>
          <div class="product-content">
            <div class="product-header">
              <h3 class="product-title">${gift.name}</h3>
              <div class="product-price">${gift.price || ''}</div>
            </div>
            <p class="product-quote">"${gift.reason || ''}"</p>
            <p class="product-sense"><strong>큐레이터 포인트</strong> ${gift.sense_point || ''}</p>
            <div class="product-tags">${tagsHtml}</div>
            <div class="product-action">
              <a href="${gift.shopping_url || '#'}" target="_blank" rel="noopener noreferrer" class="btn link-btn buy-link">
                구매처 & 최저가 검색 ↗
              </a>
            </div>
          </div>
        </article>
      `;
    }).join('');

    // 하트 저장 버튼 이벤트 바인딩
    productGrid.querySelectorAll('.heart-save-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const targetGift = gifts.find(g => g.id === id);
        if (targetGift) {
          toggleSaveItem(targetGift);
        }
      });
    });
  }

  // ----------------- 4. 필터링 버튼 -----------------
  document.querySelectorAll('.filter-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.getAttribute('data-filter');

      let filtered = currentGifts;
      if (filter === 'practical') {
        filtered = currentGifts.filter(g => (g.tags || []).some(t => t.includes('실용') || t.includes('생활')) || g.category === 'living' || g.category === 'tech');
      } else if (filter === 'emotional') {
        filtered = currentGifts.filter(g => (g.tags || []).some(t => t.includes('감성') || t.includes('힐링')) || g.category === 'beauty' || g.category === 'relax');
      } else if (filter === 'value') {
        filtered = currentGifts.filter((_, i) => i === 2 || i === 0);
      }

      if (filtered.length === 0) filtered = currentGifts;
      renderProductGrid(filtered);
      if (resultCountBadge) resultCountBadge.textContent = `총 ${filtered.length}개의 큐레이션`;
    });
  });

  // ----------------- 5. 큐레이션 요청 및 2~3초 감성 로딩 -----------------
  async function performCuration() {
    let recipient = document.getElementById('recipient').value.trim();
    if (!recipient) {
      const activeRecipientPill = document.querySelector('.pill-group[data-input="recipient"] .pill.active');
      recipient = activeRecipientPill ? activeRecipientPill.getAttribute('data-value') : '친구';
    }
    const budget = document.getElementById('budget').value.trim() || '3~5만원';
    const occasion = document.getElementById('occasion').value.trim() || '생일';
    const interests = document.getElementById('interests').value.trim() || '실용적인, 감성적인';

    hideError();
    resultContainer.style.display = 'none';
    loadingSection.style.display = 'block';
    loadingProgressFill.style.width = '0%';
    submitBtn.disabled = true;

    // 부드러운 스크롤 이동
    loadingSection.scrollIntoView({ behavior: 'smooth' });

    // 감성 단계별 로딩 메시지 애니메이션 (2.4초 보장)
    const loadingSteps = [
      "당신의 선물 취향을 분석하고 있어요...",
      "예산에 맞는 선물을 찾고 있어요...",
      "가장 잘 어울리는 선물을 고르고 있어요..."
    ];

    let stepIdx = 0;
    loadingStatusText.textContent = loadingSteps[0];
    loadingProgressFill.style.width = '25%';

    const stepTimer = setInterval(() => {
      stepIdx++;
      if (stepIdx < loadingSteps.length) {
        loadingStatusText.textContent = loadingSteps[stepIdx];
        loadingProgressFill.style.width = `${Math.min(90, (stepIdx + 1) * 30)}%`;
      }
    }, 800);

    const minDelayPromise = new Promise(resolve => setTimeout(resolve, 2400));

    try {
      const fetchPromise = fetch('/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient, budget, occasion, interests })
      });

      const [response] = await Promise.all([fetchPromise, minDelayPromise]);
      clearInterval(stepTimer);
      loadingProgressFill.style.width = '100%';

      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || '큐레이션을 불러오는 중 오류가 발생했습니다.');
      }

      currentRawData = data.data;
      currentGifts = currentRawData.gifts || [];

      // 만약 이전 구조로 왔을 경우 하위호환 안전 처리
      if (currentGifts.length === 0 && (currentRawData.gift1 || currentRawData.gift2)) {
        if (currentRawData.gift1) currentGifts.push({ ...currentRawData.gift1, id: 'gift-1', price: '₩35,000', tags: ['#BEST', '#추천1위'] });
        if (currentRawData.gift2) currentGifts.push({ ...currentRawData.gift2, id: 'gift-2', price: '₩42,000', tags: ['#ALTERNATIVE', '#추천2위'] });
      }

      // 화면 업데이트
      if (curatorSummary) {
        curatorSummary.textContent = currentRawData.summary || `${recipient}을(를) 위한 ${budget} ${occasion} 맞춤 큐레이션 컬렉션입니다.`;
      }

      if (resultCountBadge) {
        resultCountBadge.textContent = `총 ${currentGifts.length}개의 큐레이션`;
      }

      renderProductGrid(currentGifts);

      if (reviewsSummary) reviewsSummary.textContent = currentRawData.reviews_summary || '';
      if (cardMessage) cardMessage.textContent = currentRawData.card_message || '';
      if (tipsContent) tipsContent.textContent = currentRawData.tips || '';

      // 로딩 숨기고 결과 표시
      setTimeout(() => {
        loadingSection.style.display = 'none';
        resultContainer.style.display = 'block';
        resultContainer.scrollIntoView({ behavior: 'smooth' });
      }, 300);

    } catch (err) {
      clearInterval(stepTimer);
      loadingSection.style.display = 'none';
      showError(err.message);
    } finally {
      submitBtn.disabled = false;
    }
  }

  // 폼 제출 이벤트
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    performCuration();
  });

  // 조건 수정하기 버튼 (폼으로 매끄럽게 복귀)
  if (modifyConditionBtn) {
    modifyConditionBtn.addEventListener('click', () => {
      formSection.scrollIntoView({ behavior: 'smooth' });
    });
  }

  // 다시 추천받기 버튼
  if (rerunBtn) {
    rerunBtn.addEventListener('click', () => {
      performCuration();
    });
  }

  // 에러 메시지 함수
  function showError(msg) {
    errorMessage.textContent = msg;
    errorMessage.style.display = 'block';
    errorMessage.scrollIntoView({ behavior: 'smooth' });
  }

  function hideError() {
    errorMessage.textContent = '';
    errorMessage.style.display = 'none';
  }

  // 1초 완성 카드 문구 복사
  if (copyMsgBtn) {
    copyMsgBtn.addEventListener('click', async () => {
      const text = cardMessage.textContent;
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        const originalText = copyMsgBtn.textContent;
        copyMsgBtn.textContent = '복사 완료';
        setTimeout(() => { copyMsgBtn.textContent = originalText; }, 2000);
      } catch {
        alert('문구 복사에 실패했습니다.');
      }
    });
  }

  // 전체 결과 복사
  if (copyAllBtn) {
    copyAllBtn.addEventListener('click', async () => {
      if (!currentGifts || currentGifts.length === 0) return;
      let textToCopy = `[ THE GIFT CURATOR - 큐레이션 결과 ]\n\n`;
      textToCopy += `${curatorSummary.textContent}\n\n`;

      currentGifts.forEach((g, idx) => {
        textToCopy += `0${idx + 1}. ${g.name} (${g.price || ''})\n`;
        textToCopy += `- 추천 이유: ${g.reason || ''}\n`;
        textToCopy += `- 센스 포인트: ${g.sense_point || ''}\n`;
        textToCopy += `- 구매 링크: ${g.shopping_url || ''}\n\n`;
      });

      textToCopy += `[ 실사용자 리뷰 요약 ]\n${reviewsSummary.textContent}\n\n`;
      textToCopy += `[ 메시지 카드 제안 ]\n${cardMessage.textContent}\n\n`;
      textToCopy += `[ 선물 가이드 ]\n${tipsContent.textContent}\n`;

      try {
        await navigator.clipboard.writeText(textToCopy);
        const originalText = copyAllBtn.textContent;
        copyAllBtn.textContent = '전체 복사 완료';
        setTimeout(() => { copyAllBtn.textContent = originalText; }, 2000);
      } catch {
        alert('전체 복사에 실패했습니다.');
      }
    });
  }

  // PWA 서비스 워커 및 설치 버튼
  const installPwaBtn = document.getElementById('installPwaBtn');
  let deferredPrompt;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (installPwaBtn) installPwaBtn.style.display = 'inline-flex';
  });

  if (installPwaBtn) {
    installPwaBtn.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      installPwaBtn.style.display = 'none';
    });
  }

  const iosGuide = document.getElementById('iosInstallGuide');
  const isIos = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
  const isInStandalone = ('standalone' in window.navigator) && window.navigator.standalone;
  if (isIos && !isInStandalone && iosGuide) {
    iosGuide.style.display = 'block';
  }
});

// PWA 서비스 워커 등록
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .catch((err) => {
        console.warn('[PWA] Service Worker 등록 실패:', err);
      });
  });
}
