import { Button, RecordRow } from 'chatgpt-desktop-kit';
import { useNavigate, useResolvedPath } from 'react-router';
import { lessons, MODE_NAMES, uniqueAttempts } from './learning/index.js';
import { localDate } from './learning/storage.js';
import { AppLink, Hand, useLearning } from './ui.js';

export function HomePage(){
  const {data}=useLearning(),navigate=useNavigate();
  const independent=uniqueAttempts(data.attempts),read=lessons.filter(l=>data.completed.includes(l.id));
  const nextLesson=lessons.find(l=>!data.completed.includes(l.id))??lessons[0];
  const latest=[...data.attempts].sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)).at(-1);
  const quiz=data.drafts.quiz as {index?:number}|undefined;
  const quizIndex=quiz?.index??-1,continuingQuiz=Number.isInteger(quizIndex)&&quizIndex>=0&&quizIndex<20;
  const hasProgress=!!(data.attempts.length||read.length||continuingQuiz);
  const due=data.mistakes.filter(m=>m.due<=localDate()).length;
  const lastPractice=typeof data.drafts['practice-last-route']==='string'?data.drafts['practice-last-route']:null;
  const oldDraft=latest&&!latest.ref.version?data.drafts['practice:'+latest.ref.mode] as {seed?:number;submitted?:boolean}|undefined:undefined;
  const practicePath=lastPractice!==null?'practice'+(lastPractice?'?'+lastPractice:''):latest?`practice?mode=${latest.ref.mode}${oldDraft&&!oldDraft.submitted&&Number.isInteger(oldDraft.seed)?'&seed='+oldDraft.seed:latest.difficulty?'&level='+latest.difficulty:''}`:'practice';
  const startPath=continuingQuiz?'quiz/legacy':latest?practicePath:`manual/${nextLesson.id}`;
  const start=useResolvedPath(startPath,{relative:'path'});
  const startLabel=continuingQuiz?'继续旧版测验':latest?'继续练习':read.length?'继续学习':'从认牌开始';
  return <div className="mj-page mj-home">
    <section className="mj-home-intro" aria-labelledby="mj-home-title">
      <div><h1 id="mj-home-title">麻将研习</h1><p className="mj-home-lead">从认牌到攻防，循序练好每一次选择。</p>
        <div className="mj-actions"><Button variant="primary" onClick={()=>navigate(start.pathname+start.search)}>{startLabel}</Button><AppLink to={latest||continuingQuiz?`manual/${nextLesson.id}`:'practice'}>{latest||continuingQuiz?'继续阅读手册':'直接开始练习'}</AppLink></div>
        {continuingQuiz?<p className="mj-muted">上次测验：第{quizIndex+1}题。</p>:latest?<p className="mj-muted">上次练习：{MODE_NAMES[latest.ref.mode]}。</p>:null}
      </div>
      <div className="mj-home-tiles" aria-hidden="true"><Hand tiles={['1p','2p','3p','1s','2s','3s']}/></div>
    </section>
    {hasProgress&&<section className="mj-home-progress" aria-labelledby="mj-progress-title"><h2 id="mj-progress-title">你的学习进度</h2><div className="mj-stat-line"><div><span>已读课程</span><strong>{read.length}/24</strong></div><div><span>独立作答</span><strong>{independent.length}</strong></div><div><span>今日待复习</span><strong>{due}</strong></div></div><div className="mj-actions"><AppLink to="review">{due?'复习今天的错题':'查看错题本'}</AppLink><AppLink to="profile">查看学习画像</AppLink></div></section>}
    <section aria-labelledby="mj-path-title"><h2 id="mj-path-title">开始学习</h2><ol className="mj-home-path">
      <li><RecordRow className="mj-home-step" separator><span className="mj-home-number">01</span><div><strong>先认识牌和牌形</strong><p>24节课程，从牌形学起。</p></div><AppLink to="manual">学习手册</AppLink></RecordRow></li>
      <li><RecordRow className="mj-home-step" separator><span className="mj-home-number">02</span><div><strong>一次练好一个判断</strong><p>按难度练习，答后看解析。</p></div><AppLink to="practice">专项练习</AppLink></RecordRow></li>
      <li><RecordRow className="mj-home-step"><span className="mj-home-number">03</span><div><strong>把错题变成下一步</strong><p>重练错题，巩固薄弱处。</p></div><AppLink to="review">错题复习</AppLink></RecordRow></li>
    </ol></section>
    <section aria-labelledby="mj-tools-title"><h2 id="mj-tools-title">工具与挑战</h2><RecordRow className="mj-home-tool" separator><div><strong>比较一手牌的选择</strong><p>选入手牌，比较向听、进张和每种舍牌的差别。</p></div><AppLink to="analysis">手牌分析</AppLink></RecordRow><RecordRow className="mj-home-tool"><div><strong>挑战个人最佳</strong><p>六档难度，每轮20题。</p></div><AppLink to="leaderboard">排位赛</AppLink></RecordRow></section>
  </div>;
}
