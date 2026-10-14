'use client';
export default function ErrorPage({reset}:{error:Error & {digest?:string};reset:()=>void}){return <div className="container section"><h1>Something did not load.</h1><p>Please try again. No order or payment is submitted by this development preview.</p><button type="button" onClick={reset}>Try again</button></div>;}
