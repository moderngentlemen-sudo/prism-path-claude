export type Puzzle = { id: number; size: number; initial: number[]; solution: number[]; path: number[]; par: number };
export const rotate = (mask: number): number => ((mask << 1) & 15) | (mask >> 3);
export function turnsTo(from: number, to: number): number { for(let i=0;i<4;i++){if(from===to)return i;from=rotate(from);}return 0; }
export function trace(board: number[], size: number): {lit: Set<number>; solved: boolean} {
  const lit=new Set<number>(); if(!(board[0]&8))return {lit,solved:false};
  const queue=[0];lit.add(0);
  const steps=[[-1,0,1,4],[0,1,2,8],[1,0,4,1],[0,-1,8,2]];
  for(let k=0;k<queue.length;k++){
    const at=queue[k],row=Math.floor(at/size),col=at%size;
    for(const [dr,dc,bit,opposite] of steps){const r=row+dr,c=col+dc,next=r*size+c;if(r>=0&&r<size&&c>=0&&c<size&&(board[at]&bit)&&(board[next]&opposite)&&!lit.has(next)){lit.add(next);queue.push(next);}}
  }
  return {lit,solved:lit.has(size*size-1)&&!!(board[size*size-1]&2)};
}
export function makePuzzle(id: number, size=5): Puzzle {
  let seed=((id+17)*2654435761)>>>0;
  const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;};
  const shuffle=(arr:number[])=>{for(let i=arr.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];}return arr;};
  const path=[0]; const seen=new Set([0]);let calls=0;
  const walk=(at:number):boolean=>{if(at===size*size-1)return path.length>=size*2-1;if(++calls>50000)return false;
    const r=Math.floor(at/size),c=at%size;const neighbors=shuffle([r>0?at-size:-1,c<size-1?at+1:-1,r<size-1?at+size:-1,c>0?at-1:-1].filter(x=>x>=0&&!seen.has(x)));
    for(const next of neighbors){seen.add(next);path.push(next);if(walk(next))return true;path.pop();seen.delete(next);}return false;};
  if(!walk(0)){path.splice(0,path.length,...Array.from({length:size},(_,i)=>i),...Array.from({length:size-1},(_,i)=>(i+2)*size-1));}
  const direction=(a:number,b:number)=>b===a-size?1:b===a+1?2:b===a+size?4:8;
  const shapes=[3,6,12,9,5,10]; const solution=Array.from({length:size*size},()=>shapes[Math.floor(random()*shapes.length)]);
  path.forEach((at,i)=>solution[at]=(i?direction(at,path[i-1]):8)|(i===path.length-1?2:direction(at,path[i+1])));
  const initial=solution.map(m=>{for(let i=Math.floor(random()*4);i>0;i--)m=rotate(m);return m;});
  if(id<=3){path.forEach((at,i)=>initial[at]=i<id+2?rotate(solution[at]):solution[at]);}
  if(trace(initial,size).solved)initial[0]=rotate(solution[0]);
  const par=path.reduce((n,at)=>n+turnsTo(initial[at],solution[at]),0);
  return {id,size,initial,solution,path,par};
}
export function starsFor(moves:number,par:number,hints:number):number{return hints===0&&moves<=par?3:hints<=2&&moves<=Math.ceil(par*1.7)?2:1;}
export const dayNumber=(date=new Date())=>Math.floor(date.getTime()/86400000);
export const dailyIndex=(date=new Date())=>((dayNumber(date)%365)+365)%365;
export const ports=(mask:number)=>['north','east','south','west'].filter((_,i)=>mask&(1<<i)).join(' and ');
