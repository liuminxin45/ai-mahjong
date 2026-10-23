import { useEffect, useRef, useState, type RefObject } from 'react';
import { preloadTiles } from '../artwork.js';
import type { TileId } from '../engine/index.js';

export function useReducedMotion() {
  const [reduced, set] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => { const media = matchMedia('(prefers-reduced-motion: reduce)'), change = () => set(media.matches); media.addEventListener('change', change); return () => media.removeEventListener('change', change); }, []);
  return reduced;
}
/** WAAPI owns continuous values; React only records phase boundaries. */
export function useTimeline(enabled: boolean, key: string, paused: boolean, run: () => Animation[], done: () => void) {
  const complete = useRef(done), runner = useRef(run), animations = useRef<Animation[]>([]), pausedRef = useRef(paused); complete.current = done; runner.current = run; pausedRef.current = paused;
  useEffect(() => {
    if (!enabled) return;
    let live = true; animations.current = runner.current();
    const visibility = () => animations.current.forEach(a => { if (document.hidden || pausedRef.current) a.pause(); else if (a.playState === 'paused') a.play(); });
    visibility(); document.addEventListener('visibilitychange', visibility);
    Promise.all(animations.current.map(a => a.finished)).then(() => { if (live) complete.current(); }).catch(() => {});
    return () => { live = false; document.removeEventListener('visibilitychange', visibility); animations.current.forEach(a => a.cancel()); animations.current = []; };
  }, [enabled, key]);
  useEffect(() => { animations.current.forEach(a => { if (paused || document.hidden) a.pause(); else if (a.playState === 'paused') a.play(); }); }, [paused]);
}
export function usePresentation({ key, first, seen, submitted, paused, assets, tiles, root, quote, nextTiles, enter, immersive }: {
  key: string; first: boolean; seen: boolean; submitted: boolean; paused: boolean; assets: string; tiles: TileId[]; root: RefObject<HTMLElement | null>; quote: RefObject<HTMLParagraphElement | null>; nextTiles: TileId[]; enter(): void; immersive(value: boolean): void;
}) {
  const initial = useRef({ first, seen }), reduced = useReducedMotion(), [introDone, setIntroDone] = useState(!first || seen || reduced), [dealt, setDealt] = useState(seen || submitted || reduced), [loaded, setLoaded] = useState(false), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  const enterRef = useRef(enter); enterRef.current = enter;
  const swallowCleanup = useRef<()=>void>(()=>{});
  useEffect(()=>()=>swallowCleanup.current(),[]);
  useEffect(() => { enterRef.current(); }, [key]);
  useEffect(() => { let live = true; setError(''); preloadTiles(assets, tiles).then(() => { if (live) setLoaded(true); void preloadTiles(assets, nextTiles).catch(() => {}); }).catch(e => { if (live) setError(e.message); }); return () => { live = false; }; }, [key, assets, retry]);
  useEffect(() => { immersive(!introDone); return () => immersive(false); }, [introDone]);
  useEffect(() => { if (reduced) { setIntroDone(true); setDealt(true); } }, [reduced]);
  useTimeline(!introDone, key + ':intro', paused, () => quote.current ? [quote.current.animate([{ opacity: 0 }, { opacity: 1, offset: 500 / 2200 }, { opacity: 1, offset: 1600 / 2200 }, { opacity: 0, offset: 2100 / 2200 }, { opacity: 0 }], { duration: 2200, fill: 'both', easing: 'linear' })] : [], () => setIntroDone(true));
  useTimeline(introDone && loaded && !dealt, key + ':cards', paused, () => [...(root.current?.querySelectorAll<HTMLElement>(':scope > .mj-hand > .mj-tile') ?? [])].map((tile, i) => tile.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }], { delay: i * (initial.current.first ? 65 : 40), duration: initial.current.first ? 420 : 300, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'both' })), () => setDealt(true));
  const ready = introDone && loaded && dealt;
  useEffect(() => {
    if (ready || paused || error || introDone && !loaded) return;
    const skip = (e: Event) => {
      if (e instanceof KeyboardEvent && (!['Enter', ' ', 'Escape'].includes(e.key) || e.isComposing || e.repeat)) return;
      e.preventDefault(); e.stopImmediatePropagation(); setIntroDone(true); if (loaded) setDealt(true);
      swallowCleanup.current();
      const type=e instanceof KeyboardEvent?'keyup':'click';
      const swallow=(next:Event)=>{if(next instanceof KeyboardEvent&&e instanceof KeyboardEvent&&next.key!==e.key)return;next.preventDefault();next.stopImmediatePropagation();cleanup();};
      const timer=setTimeout(()=>cleanup(),500);
      const cleanup=()=>{clearTimeout(timer);document.removeEventListener(type,swallow,true);};
      document.addEventListener(type,swallow,true);swallowCleanup.current=cleanup;
    };
    document.addEventListener('pointerdown', skip, true); document.addEventListener('keydown', skip, true);
    return () => { document.removeEventListener('pointerdown', skip, true); document.removeEventListener('keydown', skip, true); };
  }, [ready, paused, loaded, error, introDone]);
  return { ready, intro: !introDone, hidden: !loaded || !dealt, error, retry: () => setRetry(n => n + 1) };
}
