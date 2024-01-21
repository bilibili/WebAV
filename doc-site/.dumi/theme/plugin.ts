
export default function (api) {
  // github-button
  api.addHTMLHeadScripts(() => `
    var timer = setInterval(() => {
      console.log(111)
      if (performance.now() > 10000) {
        clearInterval(timer)
        return
      }
      if (document.querySelector('.github-button') == null) return

      clearInterval(timer)

      var s = document.createElement('script')
      s.src = 'https://buttons.github.io/buttons.js'
      document.body.appendChild(s)
    }, 100);
  `)
}
