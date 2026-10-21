import { useState } from 'react';
import { Button } from 'chatgpt-desktop-kit';
import { useParams } from 'react-router';
import { parseHand, tileName, type TileId } from './engine/index.js';
import { lessons, UNIT_TITLES } from './learning/index.js';
import { AppLink, Hand, useLearning } from './ui.js';
export function ManualPage(){
  const {lessonId}=useParams();const {data,update}=useLearning();const [selected,setSelected]=useState<TileId|null>(null);
  const lesson=lessons.find(l=>l.id===lessonId);
  if(!lesson)return <div className="mj-page mj-reading"><p className="mj-eyebrow">从认牌到有依据地选择</p><h1>系统学习手册</h1><p>8个单元，24节课。例题可以直接送到分析器，再用专项练习检验理解。</p>{UNIT_TITLES.map((title,unit)=><section key={title} className="mj-unit"><span className="mj-unit-number">{String(unit+1).padStart(2,'0')}</span><div><h2>{title}</h2>{lessons.filter(l=>l.unit===unit).map(l=><div className="mj-lesson-link" key={l.id}><AppLink to={l.id}>{l.title}</AppLink><span className="mj-muted">{data.completed.includes(l.id)?'已读':''}</span></div>)}</div></section>)}</div>;
  const index=lessons.indexOf(lesson),hand=parseHand(lesson.example),done=data.completed.includes(lesson.id);
  return <article className="mj-page mj-reading"><AppLink to="..">← 手册目录</AppLink><p className="mj-eyebrow">{UNIT_TITLES[lesson.unit]} · 第{index+1}节</p><h1>{lesson.title}</h1>{lesson.paragraphs.map(p=><p key={p}>{p}</p>)}<section className="mj-lesson-example"><h2>动手看一看</h2><p>{lesson.question}</p><Hand tiles={hand} selected={selected?[selected]:[]} onSelect={t=>setSelected(t)}/>{selected&&<p role="status">{tileName(selected)}：这副手牌中有{hand.filter(t=>t===selected).length}张。</p>}<AppLink to={'../../analysis?hand='+encodeURIComponent(lesson.example)}>把例子送到分析器 →</AppLink></section><h2>容易忽略</h2><p>{lesson.mistake}</p><div className="mj-actions"><AppLink to={'../../practice?mode='+lesson.mode}>开始关联练习 →</AppLink><Button onClick={()=>update(d=>({...d,completed:done?d.completed.filter(x=>x!==lesson.id):[...d.completed,lesson.id]}))}>{done?'标为未读':'标记已读'}</Button></div><nav className="mj-lesson-footer">{index>0&&<AppLink to={'../'+lessons[index-1].id}>← {lessons[index-1].title}</AppLink>}{index<23&&<AppLink to={'../'+lessons[index+1].id}>{lessons[index+1].title} →</AppLink>}</nav></article>;
}
