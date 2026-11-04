import './scrollReveal.css'

const observers = new WeakMap()

export const vScrollReveal = {
  mounted(element, binding) {
    if (binding.value === false || !('IntersectionObserver' in window)
      || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const reveal = () => {
      element.classList.add('is-revealed')
      observers.get(element)?.disconnect()
    }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) reveal()
    }, { threshold: 0, rootMargin: '0px 0px -32px 0px' })

    element.classList.add('scroll-reveal')
    element.addEventListener('focusin', reveal)
    observers.set(element, observer)
    observer.observe(element)
    element._removeRevealListener = () => element.removeEventListener('focusin', reveal)
  },
  beforeUnmount(element) {
    observers.get(element)?.disconnect()
    observers.delete(element)
    element._removeRevealListener?.()
    delete element._removeRevealListener
  },
}
