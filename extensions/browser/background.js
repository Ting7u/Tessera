// Tessera 浏览器扩展：右键网页图片 → 下载到 Tessera
// 和 Tessera 应用通过本机接口（127.0.0.1）通信，端口范围要和 electron/library/bridge.js 里的 PORTS 保持一致。

const PORTS = Array.from({ length: 10 }, (_, i) => 38765 + i)
const MENU_ID = 'tessera-download-image'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ---------- 右键菜单 ----------
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    // 'all'：任何位置右键都显示。有的网站图片上盖着透明层，浏览器不认为那是图片，只用 'image' 就没有菜单
    chrome.contextMenus.create({ id: MENU_ID, title: '下载到 Tessera', contexts: ['all'] })
  })
})

// ---------- 工具栏图标上的状态提示 ----------
let badgeTimer = null
function badge(text, color, title, keepMs = 4000) {
  chrome.action.setBadgeBackgroundColor({ color })
  chrome.action.setBadgeText({ text })
  chrome.action.setTitle({ title })
  clearTimeout(badgeTimer)
  if (keepMs) {
    badgeTimer = setTimeout(() => {
      chrome.action.setBadgeText({ text: '' })
      chrome.action.setTitle({ title: 'Tessera：点击检查连接' })
    }, keepMs)
  }
}
const OK = '#2e9d5b', ERR = '#d64545', BUSY = '#7a7f8a'

// ---------- 连接 Tessera ----------
async function findPort() {
  const { port } = await chrome.storage.local.get('port')
  const order = port ? [port, ...PORTS.filter((p) => p !== port)] : PORTS
  for (const p of order) {
    try {
      const res = await fetch(`http://127.0.0.1:${p}/ping`, { signal: AbortSignal.timeout(800) })
      const info = await res.json()
      if (info && info.app === 'tessera') {
        await chrome.storage.local.set({ port: p })
        return p
      }
    } catch { /* 这个端口上没有 Tessera，试下一个 */ }
  }
  return null
}

// 第一次使用：Tessera 里会弹出确认框，这里轮询等用户点“允许”
async function pair(port) {
  const deadline = Date.now() + 60 * 1000
  while (Date.now() < deadline) {
    const res = await fetch(`http://127.0.0.1:${port}/pair`, { method: 'POST' })
    if (res.status === 200) {
      const { token } = await res.json()
      await chrome.storage.local.set({ token })
      return token
    }
    if (res.status === 202) { await sleep(1000); continue }
    throw new Error(res.status === 403 ? 'Tessera 里拒绝了这次连接，请稍后重试' : '连接 Tessera 失败')
  }
  throw new Error('等待 Tessera 确认超时，请重试')
}

const postDownload = (port, token, urls, pageUrl) =>
  fetch(`http://127.0.0.1:${port}/download`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ urls, pageUrl }),
  })

/** 确保已连接并取得令牌，返回 { port, token } */
async function connect() {
  const port = await findPort()
  if (!port) throw new Error('没有找到 Tessera，请先打开 Tessera 应用')
  const saved = (await chrome.storage.local.get('token')).token
  return { port, token: saved || (await pair(port)) }
}

async function sendToTessera(urls, pageUrl) {
  let { port, token } = await connect()
  let res = await postDownload(port, token, urls, pageUrl)
  if (res.status === 401) { // 令牌失效（例如 Tessera 里的设置被重置）：重新配对一次
    await chrome.storage.local.remove('token')
    token = await pair(port)
    res = await postDownload(port, token, urls, pageUrl)
  }
  if (!res.ok) throw new Error(`Tessera 返回了错误（${res.status}）`)
}

// ---------- 事件 ----------
/** 问页面脚本：刚才右键的位置下面是哪张图片，返回 { url, kind, w, h }（找不到、或页面没有脚本时 url 为 ''） */
async function imageUnderPointer(tab, frameId) {
  if (!tab || tab.id == null) return { url: '' }
  try {
    const reply = await chrome.tabs.sendMessage(tab.id, { type: 'tessera:get-image' }, { frameId: frameId || 0 })
    return reply && reply.url ? reply : { url: '' }
  } catch {
    return { url: '' } // 比如 chrome:// 页面，或者安装扩展前就打开的标签页（刷新后才有页面脚本）
  }
}

/** 在网页里弹提示（同时保留工具栏角标）。页面里没有脚本时静默忽略 */
function say(tab, text, kind) {
  if (!tab || tab.id == null) return
  chrome.tabs.sendMessage(tab.id, { type: 'tessera:toast', text, kind }, { frameId: 0 }).catch(() => {})
}

async function handleMenuClick(info, tab) {
  if (info.menuItemId !== MENU_ID) return
  // 优先用页面脚本找到的（能穿透透明层、取 srcset 里最大的一张）；没有再用浏览器认定的图片地址
  const found = await imageUnderPointer(tab, info.frameId)
  const url = found.url || info.srcUrl || ''
  if (!url) {
    badge('?', ERR, '这里没有找到图片。如果刚安装扩展，请先刷新这个网页', 8000)
    say(tab, '这里没有找到图片。如果刚更新过扩展，请先刷新这个网页', 'error')
    return
  }
  if (!/^https?:\/\//i.test(url)) {
    badge('!', ERR, '这张图片的地址类型暂不支持（blob: / data:），请换一张或用拖拽', 8000)
    say(tab, '这张图片的地址类型暂不支持（blob: / data:）', 'error')
    return
  }
  // 提示里写出页面上这张图的真实像素，方便和 Tessera 里下载到的尺寸核对
  const detail = found.w && found.h ? `（页面上加载的是 ${found.w}×${found.h}，来自 ${found.kind}）` : ''
  badge('…', BUSY, '正在发送给 Tessera…', 0)
  say(tab, `正在发送给 Tessera…${detail}`, 'busy')
  try {
    await sendToTessera([url], info.pageUrl || (tab && tab.url) || undefined)
    badge('✓', OK, '已发送给 Tessera，下载结果会在 Tessera 里提示')
    say(tab, '已发送，下载进度和结果请看 Tessera 窗口', 'ok')
  } catch (err) {
    badge('!', ERR, err.message, 8000)
    say(tab, err.message, 'error')
  }
}

// 点击工具栏图标：检查连接（首次点击也会触发配对）
async function handleActionClick() {
  badge('…', BUSY, '正在连接 Tessera…', 0)
  try {
    await connect()
    badge('✓', OK, '已连接 Tessera')
  } catch (err) {
    badge('!', ERR, err.message, 8000)
  }
}

chrome.contextMenus.onClicked.addListener(handleMenuClick)
chrome.action.onClicked.addListener(handleActionClick)
