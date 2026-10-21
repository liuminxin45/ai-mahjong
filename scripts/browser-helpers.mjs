// Existing flow suites start as a returning learner. The guide suite covers first visits separately.
export const returningLearner=page=>page.addInitScript(()=>{
  localStorage.setItem('neo-mahjong-guides-v1',JSON.stringify(['discard','ukeire','waits','seven-pairs','defense']));
});
