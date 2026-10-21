import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { MahjongApp } from './app.js';
import AnalysisWorker from './engine/worker?worker';
import 'chatgpt-desktop-kit/components.css';
import './styles.css';
const createWorker=()=>new AnalysisWorker();
document.body.style.margin='0';
createRoot(document.getElementById('root')!).render(<BrowserRouter><MahjongApp createWorker={createWorker} exitUrl="https://www.liuminxin.cn/works"/></BrowserRouter>);
