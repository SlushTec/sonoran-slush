// Next 15 removes its temporary export directory without retries. On this host,
// a worker's final 404 file can briefly race that cleanup (observed ENOTEMPTY).
// Use Node's bounded retry option for that generated directory only.
// This is a build-process preload; no server or storefront runtime loads it.
const fs=require('node:fs');
const nativeRemove=fs.promises.rm.bind(fs.promises);
fs.promises.rm=(target,options={})=>{
 const name=String(target).replaceAll('\\','/').replace(/\/$/,'');
 const temporaryExport=name.endsWith('/.next/export');
 return nativeRemove(target,temporaryExport&&options.recursive?{maxRetries:5,retryDelay:100,...options}:options);
};
