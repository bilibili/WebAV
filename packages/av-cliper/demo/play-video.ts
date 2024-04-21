import { Combinator } from '../src';

export function playOutputStream(
  resourceList: string[],
  attachEl: Element,
  mediaElType: 'video' | 'audio' = 'video',
) {
  const container = document.createElement('div');
  attachEl.appendChild(container);

  const resourceEl = document.createElement('div');
  resourceEl.innerHTML =
    `Resource:<br/>` +
    resourceList
      .map((str) => `<a href="${str}" target="_blank">${str}</>`)
      .join('<br/>');
  container.appendChild(resourceEl);

  const stateEl = document.createElement('div');
  stateEl.textContent = 'loading...';
  container.appendChild(stateEl);

  const mediaEl = document.createElement(mediaElType);
  mediaEl.controls = true;
  mediaEl.autoplay = true;
  if (mediaElType === 'video') {
    mediaEl.style.cssText = `
      width: 900px;
      height: 500px;
      display: block;
    `;
  }

  const btnContiner = document.createElement('div');
  container.appendChild(btnContiner);

  const closeEl = document.createElement('button');
  closeEl.textContent = 'close';
  closeEl.style.marginRight = '16px';

  btnContiner.appendChild(closeEl);
  container.appendChild(mediaEl);

  let timeStart = performance.now();
  return {
    loadStream: async (stream: ReadableStream, com?: Combinator) => {
      let closed = false;
      closeEl.onclick = () => {
        closed = true;
        com?.destroy();
        container.remove();
        URL.revokeObjectURL(mediaEl.src);
      };

      com?.on('OutputProgress', (v) => {
        console.log('----- progress:', v);
        stateEl.textContent = `progress: ${Math.round(v * 100)}%`;
      });

      const src = await new Response(stream).blob();
      if (closed) return;

      mediaEl.src = URL.createObjectURL(src);
      stateEl.textContent = `cost: ${Math.round(
        performance.now() - timeStart,
      )}ms`;

      btnContiner.appendChild(
        createDownloadBtn(mediaEl.src, mediaElType === 'video' ? 'mp4' : 'm4a'),
      );
    },
  };
}

function createDownloadBtn(url: string, suffix: 'mp4' | 'm4a') {
  const downloadEl = document.createElement('button');
  downloadEl.textContent = 'download';
  downloadEl.onclick = () => {
    const aEl = document.createElement('a');
    document.body.appendChild(aEl);
    aEl.setAttribute('href', url);
    aEl.setAttribute('download', `WebAV-export-${Date.now()}.${suffix}`);
    aEl.setAttribute('target', '_self');
    aEl.click();
  };
  return downloadEl;
}
