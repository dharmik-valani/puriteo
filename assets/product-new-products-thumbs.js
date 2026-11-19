/**
 * new-product-page thumbnail strip controller
 * Provides native horizontal scrolling on mobile touch & desktop trackpad,
 * smooth mouse-drag grab-to-scroll, vertical mouse wheel translation,
 * and seamless synchronization with the main product image and variants.
 */
(function ($) {
  'use strict';
  if (typeof $ === 'undefined') return;

  function updateActiveThumb($sliderFor, index) {
    if (!$sliderFor || !$sliderFor.length) return;
    var $visibleThumbs = getVisibleThumbs($sliderFor.closest('.product-new-products'));
    var count = $visibleThumbs.length;
    if (count <= 0) return;
    if (index < 0) index = 0;
    if (index >= count) index = count - 1;

    $sliderFor.find('.productView-thumbnail').removeClass('is-active slick-current').attr('aria-current', 'false');
    var $activeThumb = $visibleThumbs.eq(index);
    $activeThumb.addClass('is-active slick-current').attr('aria-current', 'true');

    // Scroll active thumbnail smoothly into view within $sliderFor if needed
    scrollThumbIntoView($sliderFor, $activeThumb);
  }

  function scrollThumbIntoView($sliderFor, $targetThumb) {
    if (!$sliderFor.length || !$targetThumb.length) return;
    var container = $sliderFor[0];
    var thumb = $targetThumb[0];
    if (!container || !thumb) return;

    var cRect = container.getBoundingClientRect();
    var tRect = thumb.getBoundingClientRect();

    // Check if thumbnail is cut off on left or right
    if (tRect.left < cRect.left) {
      container.scrollBy({
        left: tRect.left - cRect.left - 12,
        behavior: 'smooth'
      });
    } else if (tRect.right > cRect.right) {
      container.scrollBy({
        left: tRect.right - cRect.right + 12,
        behavior: 'smooth'
      });
    }
  }

  function getVisibleThumbs($section) {
    var $sliderFor = $section.find('.productView-thumbnail-wrapper .productView-for');
    return $sliderFor.find('.productView-thumbnail').filter(function () {
      if ($(this).hasClass('filter-hidden') || $(this).attr('data-hidden') === 'true') {
        return false;
      }
      if (this.style && this.style.display === 'none') {
        return false;
      }
      return true;
    });
  }

  function getCurrentThumbIndex($section) {
    var $sliderFor = $section.find('.productView-thumbnail-wrapper .productView-for');
    var $visibleThumbs = getVisibleThumbs($section);
    var activeIdx = $visibleThumbs.index($sliderFor.find('.productView-thumbnail.is-active'));
    if (activeIdx < 0) {
      var $sliderNav = $section.find('.productView-nav');
      if ($sliderNav.length && $sliderNav.hasClass('slick-initialized')) {
        activeIdx = $sliderNav.slick('slickCurrentSlide') || 0;
      }
    }
    return activeIdx >= 0 ? activeIdx : 0;
  }

  function findNavSlideIndex($sliderNav, mediaId, fullMediaId, targetIndex) {
    if (!$sliderNav || !$sliderNav.length) return targetIndex;

    var $slides = $sliderNav.find('.slick-slide:not(.slick-cloned)');
    if (!$slides.length) {
      $slides = $sliderNav.find('.productView-image:not(.slick-cloned)');
    }

    if (mediaId || fullMediaId) {
      for (var i = 0; i < $slides.length; i++) {
        var $slide = $($slides[i]);
        var dMedia = $slide.attr('data-media');
        var dMediaId = $slide.attr('data-media-id');
        if (
          (mediaId && (dMedia == mediaId || (dMediaId && dMediaId.split('-').pop() == mediaId))) ||
          (fullMediaId && dMediaId == fullMediaId) ||
          (mediaId && $slide.find('[data-media-id="' + mediaId + '"]').length > 0)
        ) {
          var sIdx = $slide.attr('data-slick-index');
          if (typeof sIdx !== 'undefined' && sIdx !== false && sIdx !== null && !isNaN(parseInt(sIdx, 10))) {
            return parseInt(sIdx, 10);
          }
          return i;
        }
      }
    }

    var $targetSlide = $slides.eq(targetIndex);
    if ($targetSlide.length) {
      var sIdx2 = $targetSlide.attr('data-slick-index');
      if (typeof sIdx2 !== 'undefined' && sIdx2 !== false && sIdx2 !== null && !isNaN(parseInt(sIdx2, 10))) {
        return parseInt(sIdx2, 10);
      }
    }

    return targetIndex;
  }

  function goToThumbIndex($section, targetIndex, shouldFocus) {
    var $sliderFor = $section.find('.productView-thumbnail-wrapper .productView-for');
    var $sliderNav = $section.find('.productView-nav');
    ensureSliderNavSlick($sliderNav);

    var $visibleThumbs = getVisibleThumbs($section);
    var count = $visibleThumbs.length;
    if (count <= 0) return;

    // Wrap around index if keyboard
    if (targetIndex < 0) targetIndex = count - 1;
    if (targetIndex >= count) targetIndex = 0;

    var $targetThumb = $visibleThumbs.eq(targetIndex);
    var mediaId = $targetThumb.attr('data-media') || ($targetThumb.attr('data-media-id') ? $targetThumb.attr('data-media-id').split('-').pop() : '');
    var fullMediaId = $targetThumb.attr('data-media-id');

    var navIndex = findNavSlideIndex($sliderNav, mediaId, fullMediaId, targetIndex);

    // 1. Move main product slider
    if ($sliderNav.length && $sliderNav.hasClass('slick-initialized')) {
      try {
        var slickInst = $sliderNav.slick('getSlick');
        if (slickInst) {
          if (slickInst.options && slickInst.options.asNavFor) {
            slickInst.options.asNavFor = null;
          }
          // Reset animating flag so rapid thumbnail clicks are never dropped
          slickInst.animating = false;
        }
        $sliderNav.slick('slickGoTo', navIndex, false);
      } catch (err) {
        console.error('Error navigating sliderNav:', err);
      }
    }

    // 2. Update active thumbnail highlight and scroll into view
    updateActiveThumb($sliderFor, targetIndex);

    // 3. Optionally focus the link for keyboard accessibility
    if (shouldFocus) {
      $targetThumb.find('.productView-thumbnail-link').focus();
    }
  }

  function ensureSliderNavSlick($sliderNav) {
    if (!$sliderNav || !$sliderNav.length) return;
    if ($sliderNav.hasClass('slick-initialized')) return;

    var totalNavSlides = $sliderNav.find('.productView-image:not(.slick-cloned)').length;
    if (totalNavSlides <= 1) return;

    var navArrowsDesk = $sliderNav.attr('data-arrows-desk') === 'true';
    var navArrowsMobi = $sliderNav.attr('data-arrows-mobi') === 'true';
    var isMobile = window.innerWidth < 768;

    $sliderNav.slick({
      fade: true,
      dots: false,
      arrows: isMobile ? navArrowsMobi : navArrowsDesk,
      infinite: true,
      slidesToShow: 1,
      slidesToScroll: 1,
      adaptiveHeight: false,
      swipe: true,
      draggable: true,
      touchMove: true,
      nextArrow: window.arrows && window.arrows.icon_next
        ? window.arrows.icon_next
        : '<button type="button" class="slick-next slick-arrow" aria-label="Next"><svg viewBox="0 0 24 24"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/></svg></button>',
      prevArrow: window.arrows && window.arrows.icon_prev
        ? window.arrows.icon_prev
        : '<button type="button" class="slick-prev slick-arrow" aria-label="Previous"><svg viewBox="0 0 24 24"><path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41z"/></svg></button>',
      responsive: [
        {
          breakpoint: 768,
          settings: {
            arrows: navArrowsMobi
          }
        }
      ]
    });
  }

  function updateArrowButtons($section) {
    var $sliderFor = $section.find('.productView-thumbnail-wrapper .productView-for');
    var $wrapper = $sliderFor.closest('.productView-thumbnail-wrapper');
    var $prevBtn = $wrapper.find('.productView-thumb-arrow--prev');
    var $nextBtn = $wrapper.find('.productView-thumb-arrow--next');
    if (!$sliderFor.length || (!$prevBtn.length && !$nextBtn.length)) return;

    var el = $sliderFor[0];
    var maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);

    if (maxScroll <= 2) {
      $prevBtn.prop('disabled', true).addClass('is-disabled');
      $nextBtn.prop('disabled', true).addClass('is-disabled');
      return;
    }

    var atStart = el.scrollLeft <= 4;
    var atEnd = el.scrollLeft >= maxScroll - 4;

    $prevBtn.prop('disabled', atStart).toggleClass('is-disabled', atStart);
    $nextBtn.prop('disabled', atEnd).toggleClass('is-disabled', atEnd);
  }

  function setupNativeThumbScrolling($section) {
    var $sliderFor = $section.find('.productView-thumbnail-wrapper .productView-for');
    var el = $sliderFor[0];
    if (!el) return;

    // Attach scroll listener to update arrow buttons
    $sliderFor.off('scroll.nppThumbs').on('scroll.nppThumbs', function () {
      updateArrowButtons($section);
    });

    // Arrow button clicks
    var $wrapper = $sliderFor.closest('.productView-thumbnail-wrapper');
    $wrapper.find('.productView-thumb-arrow--prev').off('click.nppThumbs').on('click.nppThumbs', function (e) {
      e.preventDefault();
      var scrollStep = Math.max(80, Math.floor(el.clientWidth * 0.7));
      el.scrollBy({ left: -scrollStep, behavior: 'smooth' });
    });
    $wrapper.find('.productView-thumb-arrow--next').off('click.nppThumbs').on('click.nppThumbs', function (e) {
      e.preventDefault();
      var scrollStep = Math.max(80, Math.floor(el.clientWidth * 0.7));
      el.scrollBy({ left: scrollStep, behavior: 'smooth' });
    });

    // If drag already initialized on this DOM element, don't re-bind window listeners
    if (el._dragInitialized) {
      updateArrowButtons($section);
      return;
    }
    el._dragInitialized = true;

    // Mouse drag-to-scroll implementation (desktop grab to scroll)
    var isDown = false;
    var startX = 0;
    var scrollLeftStart = 0;
    var hasDragged = false;
    var lastX = 0;
    var lastTime = 0;
    var velX = 0;
    var momentumAnim = null;

    el.addEventListener('mousedown', function (e) {
      if (e.button !== 0) return; // Only left mouse click
      if (el.scrollWidth <= el.clientWidth + 2) return;

      isDown = true;
      hasDragged = false;
      startX = e.pageX;
      scrollLeftStart = el.scrollLeft;
      lastX = e.pageX;
      lastTime = Date.now();
      velX = 0;
      if (momentumAnim) cancelAnimationFrame(momentumAnim);

      el.style.scrollBehavior = 'auto';
    });

    window.addEventListener('mousemove', function (e) {
      if (!isDown) return;
      var x = e.pageX;
      var walk = x - startX;

      if (Math.abs(walk) > 5) {
        hasDragged = true;
        el.classList.add('is-dragging');

        var now = Date.now();
        var dt = now - lastTime;
        if (dt > 0) {
          velX = (x - lastX) / dt;
        }
        lastX = x;
        lastTime = now;

        el.scrollLeft = scrollLeftStart - walk;
      }
    });

    var endDrag = function () {
      if (!isDown) return;
      isDown = false;
      el.classList.remove('is-dragging');
      el.style.scrollBehavior = '';

      if (hasDragged) {
        el._preventClick = true;
        setTimeout(function () {
          el._preventClick = false;
        }, 80);

        // Gentle momentum decay
        if (Math.abs(velX) > 0.15) {
          var momentum = velX * 160;
          var startScroll = el.scrollLeft;
          var startTime = performance.now();
          var duration = 280;

          var stepMomentum = function (time) {
            var elapsed = time - startTime;
            var t = Math.min(1, elapsed / duration);
            var ease = 1 - Math.pow(1 - t, 3);
            el.scrollLeft = startScroll - (momentum * ease);
            if (t < 1) {
              momentumAnim = requestAnimationFrame(stepMomentum);
            }
          };
          momentumAnim = requestAnimationFrame(stepMomentum);
        }
      }
    };

    window.addEventListener('mouseup', endDrag);
    window.addEventListener('pointercancel', endDrag);

    // Mouse wheel support:
    // Convert vertical wheel (deltaY) into horizontal scrolling if hovering,
    // but leave trackpad horizontal gestures (deltaX) untouched for native precision.
    el.addEventListener('wheel', function (e) {
      if (el.scrollWidth <= el.clientWidth + 2) return;
      if (Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;

      if (e.deltaY !== 0) {
        var prevScroll = el.scrollLeft;
        el.scrollLeft += e.deltaY;
        if (el.scrollLeft !== prevScroll) {
          e.preventDefault();
        }
      }
    }, { passive: false });

    updateArrowButtons($section);
  }

  function initOrRefreshThumbs(section) {
    var $section = $(section);
    if (!$section.length) return;
    var $sliderFor = $section.find('.productView-thumbnail-wrapper .productView-for');
    var $sliderNav = $section.find('.productView-nav');

    // Ensure main product image carousel is initialized
    ensureSliderNavSlick($sliderNav);

    // Cleanly un-slick thumbnails if slick was ever initialized
    if ($sliderFor.hasClass('slick-initialized')) {
      try {
        $sliderFor.slick('unslick');
      } catch (err) {}
    }
    $sliderFor.find('.animated-loading').removeClass('animated-loading');

    // Ensure all non-variant-hidden thumbnails are visible
    $sliderFor.find('.productView-thumbnail').each(function () {
      if (!$(this).hasClass('filter-hidden') && $(this).attr('data-hidden') !== 'true') {
        $(this).css('display', 'block');
      }
    });

    var $visibleThumbs = getVisibleThumbs($section);
    var totalSlides = $visibleThumbs.length;
    if (totalSlides <= 0) return;

    var el = $sliderFor[0];
    if (el) {
      var hasOverflow = el.scrollWidth > el.clientWidth + 2;
      $sliderFor.toggleClass('has-overflow', hasOverflow);
    }

    // Sync wrapper width and margins to match main image wrapper bounds
    var $wrapper = $sliderFor.closest('.productView-thumbnail-wrapper');
    var $imgWrapper = $section.find('.productView-image-wrapper');
    if ($wrapper.length && $wrapper[0]) {
      $wrapper[0].style.removeProperty('max-width');
      $wrapper[0].style.removeProperty('margin-left');
      $wrapper[0].style.removeProperty('margin-right');
      if ($imgWrapper.length && $imgWrapper[0]) {
        var imgStyles = window.getComputedStyle($imgWrapper[0]);
        if (imgStyles.maxWidth && imgStyles.maxWidth !== 'none' && imgStyles.maxWidth !== '100%') {
          $wrapper[0].style.setProperty('max-width', imgStyles.maxWidth, 'important');
        }
        if (imgStyles.marginLeft) {
          $wrapper[0].style.setProperty('margin-left', imgStyles.marginLeft, 'important');
        }
        if (imgStyles.marginRight) {
          $wrapper[0].style.setProperty('margin-right', imgStyles.marginRight, 'important');
        }
      }
    }

    // Break any circular asNavFor from theme.js that would cause slickGoTo errors
    if ($sliderNav.length && $sliderNav.hasClass('slick-initialized')) {
      try {
        var slickInst = $sliderNav.slick('getSlick');
        if (slickInst && slickInst.options && slickInst.options.asNavFor) {
          slickInst.options.asNavFor = null;
        }
      } catch (e) {}
    }

    // Setup native scrolling, drag to scroll, wheel scroll, and arrow buttons
    setupNativeThumbScrolling($section);

    // Highlight current active thumb
    var activeIdx = 0;
    if ($sliderNav.length && $sliderNav.hasClass('slick-initialized')) {
      activeIdx = $sliderNav.slick('slickCurrentSlide') || 0;
    }
    updateActiveThumb($sliderFor, activeIdx);

    // Two-way sync: when main slider changes (arrows, drag, keyboard), update active thumbnail and scroll into view
    $sliderNav.off('afterChange.nppThumbs').on('afterChange.nppThumbs', function (event, slick, currentSlide) {
      var $visible = getVisibleThumbs($section);
      var targetThumbIdx = currentSlide;

      var $currentSlideEl = $sliderNav.find('.slick-slide[data-slick-index="' + currentSlide + '"]:not(.slick-cloned)');
      if (!$currentSlideEl.length) {
        $currentSlideEl = $sliderNav.find('.productView-image:not(.slick-cloned)').eq(currentSlide);
      }

      if ($currentSlideEl.length) {
        var mId = $currentSlideEl.attr('data-media') || ($currentSlideEl.attr('data-media-id') ? $currentSlideEl.attr('data-media-id').split('-').pop() : '');
        var fullMId = $currentSlideEl.attr('data-media-id');
        if (mId || fullMId) {
          var $match = $visible.filter(function () {
            var dMedia = $(this).attr('data-media');
            var dMediaId = $(this).attr('data-media-id');
            return (mId && (dMedia == mId || (dMediaId && dMediaId.split('-').pop() == mId))) ||
                   (fullMId && dMediaId == fullMId);
          });
          if ($match.length) {
            targetThumbIdx = $visible.index($match);
          }
        }
      }

      updateActiveThumb($sliderFor, targetThumbIdx);
    });
  }

  window.initNewProductThumbs = initOrRefreshThumbs;

  // Handle direct click/tap on any thumbnail
  $(document).on('click', '.product-new-products .productView-thumbnail', function (e) {
    e.preventDefault();
    var $sliderFor = $(this).closest('.productView-for');
    var el = $sliderFor[0];
    if (el && el._preventClick) {
      e.stopImmediatePropagation();
      return false;
    }

    var $thumb = $(this);
    var $section = $thumb.closest('.product-new-products');
    var $visibleThumbs = getVisibleThumbs($section);
    var targetIdx = $visibleThumbs.index($thumb);

    if (targetIdx >= 0) {
      goToThumbIndex($section, targetIdx, false);
    }
  });

  // Keyboard navigation for thumbnails (ArrowLeft, ArrowRight, Home, End)
  $(document).on('keydown', function (e) {
    if ($(e.target).is('input, textarea, select, [contenteditable="true"]')) return;

    var key = e.key || e.keyCode;
    var isNext = key === 'ArrowRight' || key === 39;
    var isPrev = key === 'ArrowLeft' || key === 37;
    var isHome = key === 'Home' || key === 36;
    var isEnd = key === 'End' || key === 35;

    if (!isNext && !isPrev && !isHome && !isEnd) return;

    var $section = $(e.target).closest('.product-new-products');
    if (!$section.length) {
      $section = $('.product-new-products:hover');
    }
    if (!$section.length) {
      var $allNpp = $('.product-new-products');
      if ($allNpp.length === 1) {
        $section = $allNpp;
      }
    }

    if ($section.length) {
      var currentIdx = getCurrentThumbIndex($section);
      var visibleCount = getVisibleThumbs($section).length;

      if (isNext) {
        e.preventDefault();
        goToThumbIndex($section, currentIdx + 1, true);
      } else if (isPrev) {
        e.preventDefault();
        goToThumbIndex($section, currentIdx - 1, true);
      } else if (isHome) {
        e.preventDefault();
        goToThumbIndex($section, 0, true);
      } else if (isEnd) {
        e.preventDefault();
        goToThumbIndex($section, visibleCount - 1, true);
      }
    }
  });

  // Enter or Space key on focused thumbnail link
  $(document).on('keydown', '.product-new-products .productView-thumbnail-link', function (e) {
    var key = e.key || e.keyCode;
    if (key === 'Enter' || key === ' ' || key === 13 || key === 32) {
      e.preventDefault();
      var $thumb = $(this).closest('.productView-thumbnail');
      var $section = $thumb.closest('.product-new-products');
      var $visibleThumbs = getVisibleThumbs($section);
      var targetIdx = $visibleThumbs.index($thumb);
      if (targetIdx >= 0) {
        goToThumbIndex($section, targetIdx, true);
      }
    }
  });

  function getVariantData(variantEl) {
    if (!variantEl) return null;
    if (variantEl.currentVariant) return variantEl.currentVariant;
    var jsonScript = variantEl.querySelector('[type="application/json"]');
    if (!jsonScript) return null;
    try {
      var variants = JSON.parse(jsonScript.textContent);
      var selectedOptions = [];
      var inputs = variantEl.querySelectorAll('input:checked, select');
      for (var i = 0; i < inputs.length; i++) {
        selectedOptions.push(inputs[i].value);
      }
      for (var v = 0; v < variants.length; v++) {
        var match = true;
        for (var o = 0; o < selectedOptions.length; o++) {
          if (variants[v].options[o] !== selectedOptions[o]) {
            match = false;
            break;
          }
        }
        if (match) return variants[v];
      }
    } catch (e) {}
    return null;
  }

  function syncVariantMedia(variantSelects) {
    if (!variantSelects) return;
    var variant = getVariantData(variantSelects);
    if (!variant) return;

    var mediaId = (variant.featured_media && variant.featured_media.id) || (variant.featured_image && variant.featured_image.id);
    if (!mediaId) return;

    var sectionId = variantSelects.dataset.section;
    var $section = $(variantSelects).closest('.product-new-products');
    if (!$section.length && sectionId) {
      $section = $('#ProductSection-' + sectionId);
    }
    var $sliderNav = $section.find('.productView-nav');
    var $sliderFor = $section.find('.productView-thumbnail-wrapper .productView-for');

    ensureSliderNavSlick($sliderNav);

    // Find slide in sliderFor
    var forIndex = -1;
    var $visibleThumbs = getVisibleThumbs($section);
    var $forSlide = $visibleThumbs.filter(function () {
      var dMedia = $(this).attr('data-media');
      var dMediaId = $(this).attr('data-media-id');
      return dMedia == mediaId || dMediaId == (sectionId + '-' + mediaId) || (dMediaId && dMediaId.split('-').pop() == mediaId);
    });

    if ($forSlide.length) {
      forIndex = $visibleThumbs.index($forSlide);
    }

    // Find slide in sliderNav
    var navIndex = findNavSlideIndex($sliderNav, mediaId, (sectionId + '-' + mediaId), forIndex >= 0 ? forIndex : 0);

    // Immediately slide main image to matching variant image
    if (navIndex >= 0 && $sliderNav.length && $sliderNav.hasClass('slick-initialized')) {
      try {
        var slickInst = $sliderNav.slick('getSlick');
        if (slickInst) {
          if (slickInst.options && slickInst.options.asNavFor) {
            slickInst.options.asNavFor = null;
          }
          slickInst.animating = false;
        }
        $sliderNav.slick('slickGoTo', navIndex, false);
      } catch (err) {}
    }

    // Immediately update thumbnail active highlight and scroll into view
    if (forIndex >= 0 && $sliderFor.length) {
      updateActiveThumb($sliderFor, forIndex);
    }

    // Refresh overflow state and arrow buttons
    if ($sliderFor.length && $sliderFor[0]) {
      var el = $sliderFor[0];
      $sliderFor.toggleClass('has-overflow', el.scrollWidth > el.clientWidth + 2);
      updateArrowButtons($section);
    }
  }

  // Direct sync on variant change
  $(document).on('change', '.product-new-products variant-radios, .product-new-products variant-selects', function () {
    var self = this;
    syncVariantMedia(self);
    setTimeout(function () { syncVariantMedia(self); }, 60);
    setTimeout(function () { syncVariantMedia(self); }, 220);
    setTimeout(function () { syncVariantMedia(self); }, 450);
  });

  $(document).on('click', '.product-new-products variant-radios input, .product-new-products variant-radios label, .product-new-products .product-form__input label', function () {
    var variantEl = $(this).closest('variant-radios, variant-selects')[0];
    if (variantEl) {
      setTimeout(function () { syncVariantMedia(variantEl); }, 30);
      setTimeout(function () { syncVariantMedia(variantEl); }, 150);
      setTimeout(function () { syncVariantMedia(variantEl); }, 350);
    }
  });

  // Page load initialization
  $(document).ready(function () {
    setTimeout(function () {
      $('.product-new-products').each(function () {
        initOrRefreshThumbs(this);
        var variantEl = $(this).find('variant-radios, variant-selects')[0];
        if (variantEl) {
          syncVariantMedia(variantEl);
        }
      });
    }, 50);
  });

  // Shopify Theme Editor section lifecycle
  $(document).on('shopify:section:load shopify:section:select', function (e) {
    var $section = $(e.target).find('.product-new-products');
    if (!$section.length && $(e.target).hasClass('product-new-products')) {
      $section = $(e.target);
    }
    if ($section.length) {
      setTimeout(function () {
        initOrRefreshThumbs($section);
        var variantEl = $section.find('variant-radios, variant-selects')[0];
        if (variantEl) {
          syncVariantMedia(variantEl);
        }
      }, 50);
    }
  });

  // Window resize handler
  var resizeTimeout;
  $(window).on('resize orientationchange', function () {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(function () {
      $('.product-new-products').each(function () {
        initOrRefreshThumbs(this);
      });
    }, 150);
  });
})(window.jQuery);
