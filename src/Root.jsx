import {Composition} from 'remotion';
import {Video, DURACAO} from './Video';

const base = {component: Video, durationInFrames: DURACAO, fps: 30, width: 1080, height: 1920};

export const Root = () => (
  <>
    {/* Voz do ElevenLabs + batida própria baixinha por baixo */}
    <Composition id="Achadinhos" {...base} defaultProps={{comVoz: true, comMusica: true}} />
    {/* Voz + efeitos, sem música: pra colocar o áudio em alta no TikTok/Insta (no volume baixo) */}
    <Composition id="AchadinhosSemMusica" {...base} defaultProps={{comVoz: true, comMusica: false}} />
  </>
);
