class SliderComponent extends HTMLElement {
    constructor() {
        super();
        this.slider = this.querySelector('ul');
        this.sliderItems = this.querySelectorAll('li');
        this.pageCount = this.querySelector('.slider-counter--current');
        this.pageTotal = this.querySelector('.slider-counter--total');
        this.prevButton = this.querySelector('button[name="previous"]');
        this.nextButton = this.querySelector('button[name="next"]');
        this.dotButton = this.querySelectorAll('button[name="dots"]');
        this.rtl_num = document.body.classList.contains('layout_rtl') ? -1 : 1;
            
        if (!this.slider || !this.nextButton) return;

        const resizeObserver = new ResizeObserver(entries => this.initPages());
        resizeObserver.observe(this.slider);

        this.slider.addEventListener('scroll', this.update.bind(this));
        this.prevButton.addEventListener('click', this.onButtonClick.bind(this));
        this.nextButton.addEventListener('click', this.onButtonClick.bind(this));
        this.dotButton.forEach((button) => {
            button.addEventListener('click', this.onDotClick.bind(this));
        });
    }   

    getMaxScroll() {
        if (!this.slider) return 0;
        return Math.max(0, this.slider.scrollWidth - this.slider.clientWidth);
    }

    getSlideStep() {
        if (!this.sliderItems?.length) return this.slider?.clientWidth || 0;
        const item = this.sliderItems[0];
        const style = window.getComputedStyle(this.slider);
        const gap = parseFloat(style.columnGap || style.gap || '0') || 0;
        return item.clientWidth + gap;
    }

    initPages() {
        if (this.sliderItems.length === 0) return;
        const step = Math.max(1, this.sliderItems[0].clientWidth);
        this.slidesPerPage = Math.max(1, Math.floor(this.slider.clientWidth / step));
        this.totalPages = Math.max(1, this.sliderItems.length - this.slidesPerPage + 1);
        if (this.pageCount) this.pageCount.innerText = this.slidesPerPage;
        this.update();
    }   

    update() {
        if (!this.sliderItems?.length) return;
        const step = Math.max(1, this.getSlideStep());
        const maxScroll = this.getMaxScroll();
        let page = Math.round((this.slider.scrollLeft * this.rtl_num) / step);
        if (maxScroll > 2 && this.slider.scrollLeft >= maxScroll - 3) {
            page = Math.max(0, (this.totalPages || 1) - 1);
        }
        this.currentPage = Math.max(0, page);
        this.querySelector('.dots-item.active')?.classList.remove('active');
        this.querySelectorAll('.dots-item')[this.currentPage]?.classList.add('active');
        if (this.pageCount) this.pageCount.innerText = this.slidesPerPage + this.currentPage;
    }

    scrollSliderTo(left) {
        if (!this.slider) return;
        const maxScroll = this.getMaxScroll();
        const target = Math.min(maxScroll, Math.max(0, left));
        const prevSnap = this.slider.style.scrollSnapType;
        this.slider.style.scrollSnapType = 'none';
        this.slider.scrollTo({ left: target, behavior: 'smooth' });
        window.setTimeout(() => {
            if (Math.abs(this.slider.scrollLeft - target) > 2) {
                this.slider.scrollLeft = target;
            }
            this.slider.style.scrollSnapType = prevSnap;
            this.update();
        }, 400);
    }

    onButtonClick(event) {
        event.preventDefault();
        event.stopPropagation();
        const step = this.getSlideStep() * this.rtl_num;
        const slideScrollPosition = event.currentTarget.name === 'next'
            ? this.slider.scrollLeft + step
            : this.slider.scrollLeft - step;
        this.scrollSliderTo(slideScrollPosition);
    }

    onDotClick(event) {
        event.preventDefault();
        event.stopPropagation();
        this.dotActive = this.querySelector('.dots-item.active button');
        const sliderItem = Number(event.currentTarget.dataset.index || 0);
        this.querySelector('.dots-item.active')?.classList.remove('active');
        event.currentTarget.closest('.dots-item')?.classList.add('active');

        const slideScrollPosition = sliderItem * this.getSlideStep() * this.rtl_num;
        this.scrollSliderTo(slideScrollPosition);
    }
}

customElements.define('slider-component', SliderComponent);

class ProductSliderComponent extends SliderComponent {
    constructor() {
        super();
        this.slider = this.querySelector('.slider');
        this.sliderItems = this.querySelectorAll('.slider__slide');
        if (this.sliderItems.length === 0) this.sliderItems = this.querySelectorAll('.slider div.product');
        if (!this.slider || !this.nextButton) return;

        const resizeObserver = new ResizeObserver(entries => this.initPages());
        resizeObserver.observe(this.slider);

        const observerSubtree = new MutationObserver(() => {
            this.slider = this.querySelector('.slider');
            this.sliderItems = this.querySelectorAll('.slider__slide').length ? this.querySelectorAll('.slider__slide') : this.querySelectorAll('.slider div.product');
            this.slider.addEventListener('scroll', this.update.bind(this));
            this.prevButton?.addEventListener('click', this.onButtonClick.bind(this));
            this.nextButton?.addEventListener('click', this.onButtonClick.bind(this));
            this.dotButton.forEach((button) => {
                button.addEventListener('click', this.onDotClick.bind(this));
            });
        });
        
        observerSubtree.observe(this.slider, {
            subtree: true,
            childList: true,
        });

        this.slider.addEventListener('scroll', this.update.bind(this));
        this.prevButton?.addEventListener('click', this.onButtonClick.bind(this));
        this.nextButton?.addEventListener('click', this.onButtonClick.bind(this));
        this.dotButton.forEach((button) => {
            button.addEventListener('click', this.onDotClick.bind(this));
        });
    }
}

class BannerSliderComponent extends SliderComponent {
    constructor() {
        super();
        this.slider = this.querySelector('.slider');
        this.sliderItems = this.querySelectorAll('.slider__slide');

        if (!this.slider || !this.dotButton) return;

        const resizeObserver = new ResizeObserver(entries => this.initPages());
        resizeObserver.observe(this.slider);

        const observerSubtree = new MutationObserver(() => {
            this.slider = this.querySelector('.slider');
            this.sliderItems = this.querySelectorAll('.slider__slide');
            this.slider.addEventListener('scroll', this.update.bind(this));
            this.prevButton?.addEventListener('click', this.onButtonClick.bind(this));
            this.nextButton?.addEventListener('click', this.onButtonClick.bind(this));
            this.dotButton.forEach((button) => {
                button.addEventListener('click', this.onDotClick.bind(this));
            });
        });
        
        observerSubtree.observe(this.slider, {
            subtree: true,
            childList: true,
        });
        
        this.slider.addEventListener('scroll', this.update.bind(this));
        this.prevButton?.addEventListener('click', this.onButtonClick.bind(this));
        this.nextButton?.addEventListener('click', this.onButtonClick.bind(this));
        this.dotButton.forEach((button) => {
            button.addEventListener('click', this.onDotClick.bind(this));
        });
        this.initButtonDisable();
    }
    
    initButtonDisable() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    if (entry.target.classList.contains('first-item')) {
                        this.prevButton?.classList.add('disabled')    
                    } else if (entry.target.classList.contains('last-item')) {
                        this.nextButton?.classList.add('disabled')    
                    }
                } else {
                    if (entry.target.classList.contains('first-item')) {
                        this.prevButton?.classList.remove('disabled')   
                    } else if (entry.target.classList.contains('last-item')) {
                        this.nextButton?.classList.remove('disabled')   
                    }
                }
            })
        }, {
            threshold: 0.8,
            root: this.slider 
        })

        this.sliderItems[0].classList.add('first-item')
        this.sliderItems[this.sliderItems.length - 1].classList.add('last-item')

        observer.observe(this.sliderItems[0])
        observer.observe(this.sliderItems[this.sliderItems.length - 1])
    }
}

class TiktokSliderComponent extends BannerSliderComponent {
    constructor() {
        super();

        this.sliderActionsAndPageCount = this.querySelector('.slider-buttons');
    }

    initPages() {
        if (this.sliderItems.length === 0) return;
        const distance = this.slider.clientWidth / this.sliderItems[0].clientWidth;

        this.slidesPerPage = distance % 1 > 0.5 ? Math.ceil(distance) : Math.floor(distance);
        this.totalPages = Math.ceil(this.sliderItems.length - this.slidesPerPage) + 1;

        if (this.pageTotal && this.dataset.tiktokSlider === 'true') {
            this.pageTotal.innerText = this.totalPages;
        }   

        if (this.totalPages <= 1 || window.innerWidth >= 1025) {
            this.sliderActionsAndPageCount.style.display = 'none';
        } else if (this.totalPages > 1) this.sliderActionsAndPageCount.style.display = 'flex';
    }   
}

window.addEventListener('load', () => {
    customElements.define('banner-slider-component', BannerSliderComponent);
    customElements.define('product-slider-component', ProductSliderComponent);
    customElements.define('tiktok-slider-component', TiktokSliderComponent);
})
