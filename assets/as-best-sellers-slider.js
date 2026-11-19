if (!customElements.get('best-sellers-slider')) {
  class BestSellersSlider extends HTMLElement {
    connectedCallback() {
      this.track = this.querySelector('[data-bs-track]');
      this.prevBtn = this.querySelector('[data-bs-prev]');
      this.nextBtn = this.querySelector('[data-bs-next]');
      this.dotsWrap = this.querySelector('[data-bs-dots]');
      if (!this.track) return;

      this.refreshSlides();
      if (!this.slides.length) return;

      this.isScrolling = false;
      this.scrollEndTimer = null;
      this.resizeTimer = null;

      this.onScroll = this.onScroll.bind(this);
      this.onResize = this.onResize.bind(this);
      this.onPrev = this.onPrev.bind(this);
      this.onNext = this.onNext.bind(this);

      this.prevBtn?.addEventListener('click', this.onPrev);
      this.nextBtn?.addEventListener('click', this.onNext);
      this.track.addEventListener('scroll', this.onScroll, { passive: true });
      window.addEventListener('resize', this.onResize);

      if (typeof ResizeObserver !== 'undefined') {
        this.resizeObserver = new ResizeObserver(() => this.onResize());
        this.resizeObserver.observe(this.track);
      }

      requestAnimationFrame(() => {
        this.refreshSlides();
        this.buildDots();
        this.updateUI();
      });
    }

    disconnectedCallback() {
      this.track?.removeEventListener('scroll', this.onScroll);
      this.prevBtn?.removeEventListener('click', this.onPrev);
      this.nextBtn?.removeEventListener('click', this.onNext);
      window.removeEventListener('resize', this.onResize);
      this.resizeObserver?.disconnect();
      window.clearTimeout(this.scrollEndTimer);
      window.clearTimeout(this.resizeTimer);
    }

    refreshSlides() {
      this.slides = Array.from(this.querySelectorAll('[data-bs-slide]'));
    }

    onPrev(event) {
      event.preventDefault();
      event.stopPropagation();
      this.scrollByPage(-1);
    }

    onNext(event) {
      event.preventDefault();
      event.stopPropagation();
      this.scrollByPage(1);
    }

    /** Match CSS breakpoints used by best-sellers slide widths */
    getColumns() {
      const width = window.innerWidth;
      if (width < 750) return Math.max(1, Number(this.dataset.columnsMobile || 2));
      if (width < 1025) return Math.max(1, Number(this.dataset.columnsTablet || 3));
      return Math.max(1, Number(this.dataset.columnsDesktop || 4));
    }

    getPageCount() {
      const columns = this.getColumns();
      return Math.max(1, Math.ceil(this.slides.length / columns));
    }

    getMaxScroll() {
      if (!this.track) return 0;
      return Math.max(0, this.track.scrollWidth - this.track.clientWidth);
    }

    getNearestSlideIndex() {
      if (!this.track || !this.slides.length) return 0;
      const left = this.track.scrollLeft;
      let best = 0;
      let bestDist = Infinity;

      this.slides.forEach((slide, index) => {
        const dist = Math.abs(slide.offsetLeft - left);
        if (dist < bestDist) {
          bestDist = dist;
          best = index;
        }
      });

      return best;
    }

    currentPage() {
      const maxScroll = this.getMaxScroll();
      const maxPage = this.getPageCount() - 1;
      if (maxScroll <= 2) return 0;
      if (this.track.scrollLeft >= maxScroll - 3) return maxPage;

      const columns = this.getColumns();
      const page = Math.floor(this.getNearestSlideIndex() / columns);
      return Math.min(maxPage, Math.max(0, page));
    }

    scrollToSlide(index) {
      if (!this.track || !this.slides.length) return;

      this.refreshSlides();
      const clamped = Math.max(0, Math.min(this.slides.length - 1, index));
      const slide = this.slides[clamped];
      if (!slide) return;

      const maxScroll = this.getMaxScroll();
      const target = Math.min(maxScroll, Math.max(0, slide.offsetLeft));
      const track = this.track;

      this.isScrolling = true;
      window.clearTimeout(this.scrollEndTimer);

      const prevSnap = track.style.scrollSnapType;
      track.style.scrollSnapType = 'none';

      if (typeof track.scrollTo === 'function') {
        track.scrollTo({ left: target, behavior: 'smooth' });
      } else {
        track.scrollLeft = target;
      }

      this.scrollEndTimer = window.setTimeout(() => {
        if (Math.abs(track.scrollLeft - target) > 2) {
          track.scrollLeft = target;
        }
        track.style.scrollSnapType = prevSnap;
        this.isScrolling = false;
        this.updateUI();
      }, 450);
    }

    scrollByPage(direction) {
      if (!this.track || this.getMaxScroll() <= 2) return;

      const columns = this.getColumns();
      const currentIndex = this.getNearestSlideIndex();
      let nextIndex = currentIndex + direction * columns;

      if (direction > 0) {
        nextIndex = Math.min(nextIndex, Math.max(0, this.slides.length - columns));
      } else {
        nextIndex = Math.max(0, nextIndex);
      }

      if (nextIndex === currentIndex) {
        nextIndex = Math.max(0, Math.min(this.slides.length - 1, currentIndex + direction));
      }

      this.scrollToSlide(nextIndex);
      this.updateUI();
    }

    goToPage(index) {
      if (!this.track) return;
      const columns = this.getColumns();
      const maxPage = this.getPageCount() - 1;
      const page = Math.max(0, Math.min(maxPage, index));
      const slideIndex = Math.min(page * columns, Math.max(0, this.slides.length - columns));
      this.scrollToSlide(slideIndex);
      this.updateUI();
    }

    buildDots() {
      if (!this.dotsWrap) return;

      const pages = this.getPageCount();
      const existing = this.dotsWrap.querySelectorAll('.best-sellers__dot');
      if (existing.length === pages) return;

      this.dotsWrap.innerHTML = '';

      for (let i = 0; i < pages; i++) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'best-sellers__dot';
        button.setAttribute('aria-label', `Go to slide group ${i + 1}`);
        button.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          this.goToPage(i);
        });
        this.dotsWrap.appendChild(button);
      }
    }

    updateUI() {
      if (!this.track) return;

      this.refreshSlides();
      const page = this.currentPage();
      const maxPage = this.getPageCount() - 1;
      const maxScroll = this.getMaxScroll();
      const scrollLeft = this.track.scrollLeft;
      const canScroll = maxScroll > 2;
      const atStart = !canScroll || scrollLeft <= 2;
      const atEnd = !canScroll || scrollLeft >= maxScroll - 3;

      // First products: left muted, right clear. Last products: right muted, left clear.
      if (this.prevBtn) {
        this.prevBtn.disabled = atStart;
        this.prevBtn.setAttribute('aria-disabled', atStart ? 'true' : 'false');
        this.prevBtn.classList.toggle('is-disabled', atStart);
      }
      if (this.nextBtn) {
        this.nextBtn.disabled = atEnd;
        this.nextBtn.setAttribute('aria-disabled', atEnd ? 'true' : 'false');
        this.nextBtn.classList.toggle('is-disabled', atEnd);
      }

      this.classList.toggle('is-at-start', atStart);
      this.classList.toggle('is-at-end', atEnd);

      if (this.dotsWrap) {
        if (this.dotsWrap.querySelectorAll('.best-sellers__dot').length !== this.getPageCount()) {
          this.buildDots();
        }
        this.dotsWrap.querySelectorAll('.best-sellers__dot').forEach((dot, index) => {
          const active = index === page || (page > maxPage && index === maxPage);
          dot.classList.toggle('is-active', active);
          dot.setAttribute('aria-current', active ? 'true' : 'false');
        });
      }
    }

    onScroll() {
      window.requestAnimationFrame(() => this.updateUI());
    }

    onResize() {
      window.clearTimeout(this.resizeTimer);
      this.resizeTimer = window.setTimeout(() => {
        this.refreshSlides();
        this.buildDots();
        this.updateUI();
      }, 100);
    }
  }

  customElements.define('best-sellers-slider', BestSellersSlider);
}
