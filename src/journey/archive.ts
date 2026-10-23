import type {LearningData} from '../learning/storage.js';
export type OldReport={reportId:string;at:string;text:string};
export function oldReports(d:LearningData):OldReport[]{
 const reports=[
  ...(d.story?.reports??[]).map(r=>({reportId:r.reportId,at:r.at,text:r.profile.observation.text+' '+r.profile.reflection.text})),
  ...(d.experience?.reports??[]).map(r=>({reportId:r.reportId,at:r.at,text:r.profile.observation.text+' '+r.profile.reflection.text})),
  ...(d.decision?.reports??[]).map(r=>({reportId:r.reportId,at:r.at,text:r.profile.summary+' '+r.profile.suggestion})),
  ...(d.training?.reports??[]).map(r=>({reportId:r.reportId,at:r.at,text:r.profile.summary+' '+r.profile.suggestion})),
  ...d.profiles.map(r=>({reportId:r.reportId,at:r.at,text:r.profile.summary}))
 ];
 const seen=new Set<string>();return reports.filter(r=>{if(seen.has(r.reportId))return false;seen.add(r.reportId);return true;}).sort((a,b)=>(Date.parse(b.at)||0)-(Date.parse(a.at)||0));
}
/** Remove the report copy, never its underlying attempts or reading position. */
export function forgetReport(d:LearningData,id:string):LearningData{return {...d,
 profiles:d.profiles.filter(r=>r.reportId!==id),
 ...(d.tables?{tables:{...d.tables,reports:d.tables.reports.filter(r=>r.reportId!==id)}}:{}),
 ...(d.story?{story:{...d.story,reports:d.story.reports.filter(r=>r.reportId!==id)}}:{}),
 ...(d.experience?{experience:{...d.experience,reports:d.experience.reports.filter(r=>r.reportId!==id)}}:{}),
 ...(d.decision?{decision:{...d.decision,reports:d.decision.reports.filter(r=>r.reportId!==id)}}:{}),
 ...(d.training?{training:{...d.training,reports:d.training.reports.filter(r=>r.reportId!==id)}}:{})
};}
