// Tessera 浏览器扩展：页面脚本
// 作用：右键时记下“鼠标指针下面”的图片地址。
// 为什么需要：像 Instagram 这类网站，图片上盖着透明的层，浏览器认为你点的不是图片，右键菜单里就没有图片相关的选项；
// 这里用 document.elementsFromPoint 取出指针下面所有叠在一起的元素，自己把图片找出来。

const MIN_SIZE = 40 // 小于这个尺寸（像素）的图片多半是图标、头像角标，不当作目标

let last = null // { url, at }

/** 把相对地址变成完整地址；失败返回 '' */
function absolute(url) {
  try { return new URL(url, document.baseURI).href } catch { return '' }
}

/** 从 srcset 里挑最大的一张（按 w 或 x 描述符）；没有 srcset 返回 '' */
function largestFromSrcset(srcset) {
  let best = ''
  let bestScore = -1
  for (const part of String(srcset || '').split(/,\s+(?=\S)|,$/)) { // 逗号后跟空白才是分隔（地址里可能有逗号）
    const [url, desc] = part.trim().split(/\s+/)
    if (!url) continue
    const score = desc ? parseFloat(desc) || 0 : 1
    if (score > bestScore) { best = url; bestScore = score }
  }
  return best ? absolute(best) : ''
}

/** <img> 的最佳地址：srcset 里最大的；没有就用浏览器当前实际加载的那张 */
function imageUrl(img) {
  return largestFromSrcset(img.srcset) || absolute(img.currentSrc || img.src)
}

/** 取出 CSS background-image 里所有 url(...) */
function backgroundUrls(el) {
  const value = getComputedStyle(el).backgroundImage
  if (!value || value === 'none') return []
  const out = []
  for (const m of value.matchAll(/url\((["']?)(.*?)\1\)/g)) {
    const url = absolute(m[2])
    if (url) out.push(url)
  }
  return out
}

/** 指针下面所有元素，从最上层到最底层；会钻进开放的 shadow DOM */
function elementsAt(x, y, root = document, seen = new Set()) {
  const out = []
  for (const el of root.elementsFromPoint(x, y)) {
    if (seen.has(el)) continue // shadow root 的结果里也会带上宿主元素本身，不去重会无限递归
    seen.add(el)
    if (el.shadowRoot) out.push(...elementsAt(x, y, el.shadowRoot, seen))
    out.push(el)
  }
  return out
}

/**
 * 找指针下面的图片：先看 <img>（最上层、够大的那张），再看 <video> 的封面，最后看 CSS 背景图。
 * 返回完整地址，找不到返回 ''
 */
function findImageAt(x, y) {
  const els = elementsAt(x, y)
  const big = (el) => { const r = el.getBoundingClientRect(); return r.width >= MIN_SIZE && r.height >= MIN_SIZE }
  // 返回 { url, kind, w, h }：w/h 是浏览器加载到的图片真实像素（背景图拿不到时为 0），用于在页面提示里让人核对
  const hit = (url, kind, el) => ({ url, kind, w: el.naturalWidth || el.videoWidth || 0, h: el.naturalHeight || el.videoHeight || 0 })

  for (const el of els) {
    if (el instanceof HTMLImageElement && big(el)) {
      const url = imageUrl(el)
      if (url) return hit(url, '<img>', el)
    }
  }
  for (const el of els) {
    if (el instanceof HTMLVideoElement && el.poster && big(el)) return hit(absolute(el.poster), '视频封面', {})
  }
  for (const el of els) {
    if (el instanceof HTMLElement && big(el)) {
      const [url] = backgroundUrls(el)
      if (url) return hit(url, 'CSS 背景图', {})
    }
  }
  // 兜底：有的网站图片很小（比如头像），放宽尺寸再找一次 <img>
  for (const el of els) {
    if (el instanceof HTMLImageElement) {
      const url = imageUrl(el)
      if (url) return hit(url, '<img>', el)
    }
  }
  return null
}

// 捕获阶段监听：网站自己阻止了右键事件冒泡也拦不住我们
document.addEventListener('contextmenu', (event) => {
  try {
    last = { found: findImageAt(event.clientX, event.clientY), at: Date.now() }
  } catch {
    last = null
  }
}, true)

// ---------- 页面内提示 ----------
// 工具栏图标上的角标很容易被忽略（图标没固定出来时根本看不到），所以在网页右下角也弹一条提示。
// 放在 shadow DOM 里，不受网页样式影响，也不影响网页
let toastHost = null
let toastTimer = null
function showToast(text, kind) {
  if (window !== window.top) return // 只在顶层页面显示，iframe 里不重复
  if (!toastHost) {
    toastHost = document.createElement('div')
    toastHost.style.cssText = 'all:initial;position:fixed;right:16px;bottom:16px;z-index:2147483647;pointer-events:none'
    toastHost.attachShadow({ mode: 'open' }).innerHTML = '<div id="t" style="font:14px/1.5 system-ui,sans-serif;max-width:360px;padding:10px 14px;border-radius:8px;color:#fff;box-shadow:0 4px 16px rgba(0,0,0,.35);word-break:break-all"></div>'
  }
  const box = toastHost.shadowRoot.getElementById('t')
  box.textContent = 'Tessera：' + text
  box.style.background = kind === 'error' ? '#c0392b' : kind === 'ok' ? '#2e7d4f' : '#3a3f4b'
  if (!toastHost.isConnected) (document.documentElement || document.body).appendChild(toastHost)
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => toastHost.remove(), kind === 'busy' ? 15000 : 6000)
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message) return
  // 背景脚本点菜单时来问：返回最近一次右键位置下的图片（超过 30 秒的不算，避免用到旧的）
  if (message.type === 'tessera:get-image') {
    const fresh = last && Date.now() - last.at < 30000 ? last.found : null
    sendResponse(fresh || { url: '' })
  } else if (message.type === 'tessera:toast') {
    showToast(String(message.text || ''), message.kind)
  }
})
