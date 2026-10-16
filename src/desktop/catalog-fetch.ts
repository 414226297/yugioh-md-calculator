import {net} from 'electron';
import type {CatalogFetch} from '../data/download-catalog.js';

/** net.fetch throws on manual redirects; expose redirect responses through net.request. */
export const fetchCatalogResponse:CatalogFetch=(url,{signal})=>new Promise((resolve,reject)=>{
  if(signal.aborted){reject(signal.reason);return;}
  const request=net.request({url,redirect:'manual',credentials:'omit'});
  let done=false;
  const finish=(error?:unknown,response?:Response)=>{
    if(done)return;done=true;signal.removeEventListener('abort',abort);
    if(error)reject(error);else resolve(response!);
  };
  const abort=()=>{finish(signal.reason??Error('卡片属性下载已取消'));request.abort();};
  signal.addEventListener('abort',abort,{once:true});
  request.on('error',error=>finish(error));
  request.on('abort',()=>finish(Error('卡片属性下载已取消')));
  request.on('redirect',(status,_method,target)=>{
    finish(undefined,new Response(null,{status,headers:{location:target}}));request.abort();
  });
  request.on('response',response=>{
    const chunks:Buffer[]=[];let bytes=0;
    response.on('data',chunk=>{
      bytes+=chunk.length;if(bytes>20*1024*1024){finish(Error('卡片属性下载超过20MB上限'));request.abort();return;}
      chunks.push(chunk);
    });
    response.on('error',error=>finish(error));
    response.on('end',()=>{
      const headers=new Headers();for(const [name,value] of Object.entries(response.headers))headers.set(name,Array.isArray(value)?value.join(', '):value);
      finish(undefined,new Response(Buffer.concat(chunks).toString('utf8'),{status:response.statusCode,headers}));
    });
  });
  request.end();
});
