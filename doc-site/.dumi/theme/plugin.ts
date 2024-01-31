
export default function (api) {
  // github-button
  api.addHTMLHeadScripts(() => `
    var timer = setInterval(() => {
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

  api.addHTMLHeadScripts(() => `
    (function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window, document, "clarity", "script", "kudfzh7lis");
  `)
}
