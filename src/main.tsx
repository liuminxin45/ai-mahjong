import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { MahjongApp } from './app.js';
import 'chatgpt-desktop-kit/components.css';
import './styles.css';
document.body.style.margin='0';
createRoot(document.getElementById('root')!).render(<BrowserRouter><MahjongApp exitUrl="https://www.liuminxin.cn/works"/></BrowserRouter>);
