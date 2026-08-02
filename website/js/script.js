function initNavScroll() {
  const nav = document.querySelector('nav');
  if (nav) {
    window.addEventListener('scroll', function() {
      if (window.scrollY > 20) {
        nav.classList.add('scrolled');
      } else {
        nav.classList.remove('scrolled');
      }
    });
  }
}

// Try to initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', function() {
  if (document.querySelector('nav')) {
    initNavScroll();
  } else {
    // Wait for header to be loaded dynamically
    const observer = new MutationObserver(function(mutations) {
      if (document.querySelector('nav')) {
        initNavScroll();
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
});
