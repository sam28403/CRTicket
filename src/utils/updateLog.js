import { computed } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'



const sources = import.meta.glob('../content/changelog/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
})

export const entries = computed(() => Object.entries(sources)
  .sort(([left], [right]) => right.localeCompare(left))
  .map(([path, content]) => ({
    path,
    html: DOMPurify.sanitize(marked.parse(content, { async: false }), {
      USE_PROFILES: { html: true },
    }),
  })))

