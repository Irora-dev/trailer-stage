// Film the running Daylight app at phone size, for the phone-screen reference of the live-action
// piece (2026-09-07). Free. Usage (from ~/Irora-dev/trailer-stage so puppeteer-core resolves):
//   node <this file> <url> <out.png> [waitMs] [clickText]
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
const puppeteer = (await import('puppeteer-core')).default
const [url, out, waitMs = '3500', clickText] = process.argv.slice(2)
if (!url || !out) {
  console.error('usage: shoot-phone.mjs <url> <out.png> [waitMs] [clickText]')
  process.exit(1)
}
mkdirSync(dirname(out), { recursive: true })
const browser = await puppeteer.launch({
  executablePath: '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  headless: true,
  args: ['--no-first-run', '--no-default-browser-check', '--hide-scrollbars'],
})
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true })
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 })
  await new Promise((r) => setTimeout(r, Number(waitMs)))
  if (clickText) {
    const clicked = await page.evaluate((t) => {
      const els = [...document.querySelectorAll('button, a, [role=button]')]
      const el = els.find((e) => (e.textContent || '').trim().toLowerCase().includes(t.toLowerCase()))
      if (el) {
        el.scrollIntoView({ block: 'center' })
        el.click()
        return (el.textContent || '').trim()
      }
      return null
    }, clickText)
    console.log('clicked:', clicked)
    await new Promise((r) => setTimeout(r, Number(waitMs)))
  }
  await page.screenshot({ path: out, type: 'png' })
  const texts = await page.evaluate(() => [...document.querySelectorAll('button, a, [role=button]')].map((e) => (e.textContent || '').trim()).filter(Boolean).slice(0, 40))
  console.log('wrote', out)
  console.log('controls on screen:', JSON.stringify(texts))
} finally {
  await browser.close()
}
