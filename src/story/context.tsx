import { createContext, useContext } from 'react';
import { useLearning } from '../ui.js';
import { createStoryClient, type StoryClient } from '../client.js';
import { emptyStory, NARRATIVE_VERSION, type StoryState } from './index.js';
import type { AudioDirector } from './resources.js';

export const StorySurface = createContext<{
  audio: AudioDirector | null;
  paused: boolean;
  client: StoryClient;
}>({audio:null,paused:false,client:createStoryClient()});

export function useStory() {
  const learning=useLearning(),surface=useContext(StorySurface),state=learning.data.story??emptyStory();
  return {...learning,...surface,state,journey:[...state.journeys].reverse().find(j=>j.edition===NARRATIVE_VERSION),change:(fn:(s:StoryState)=>StoryState)=>learning.update(d=>({...d,story:fn(d.story??emptyStory())}))};
}
