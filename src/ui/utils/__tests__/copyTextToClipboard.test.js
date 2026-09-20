import {afterEach,describe,expect,it,vi} from 'vitest';
import {copyTextToClipboard} from '../copyTextToClipboard.js';
const clipboard=Object.getOwnPropertyDescriptor(navigator,'clipboard');
const exec=Object.getOwnPropertyDescriptor(document,'execCommand');
afterEach(()=>{for(const [target,key,descriptor] of [[navigator,'clipboard',clipboard],[document,'execCommand',exec]]){if(descriptor)Object.defineProperty(target,key,descriptor);else delete target[key];}document.body.innerHTML='';});
const install=(write,legacy)=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:write?{writeText:write}:undefined});Object.defineProperty(document,'execCommand',{configurable:true,value:legacy});};
describe('clipboard copy feedback',()=>{
 it('copies through the clipboard API without creating a field',async()=>{const write=vi.fn().mockResolvedValue(undefined),legacy=vi.fn();install(write,legacy);expect(await copyTextToClipboard('ABC234')).toBe(true);expect(write).toHaveBeenCalledWith('ABC234');expect(legacy).not.toHaveBeenCalled();expect(document.querySelector('textarea')).toBeNull();});
 it('supports local HTTP copy and restores focus',async()=>{const button=document.createElement('button');document.body.append(button);button.focus();install(null,()=>{expect(document.querySelector('textarea').value).toBe('ABC234');return true;});expect(await copyTextToClipboard('ABC234')).toBe(true);expect(document.querySelector('textarea')).toBeNull();expect(document.activeElement).toBe(button);});
 it('does not report success when both copy methods are denied',async()=>{install(vi.fn().mockRejectedValue(new Error('denied')),()=>false);expect(await copyTextToClipboard('ABC234')).toBe(false);expect(document.querySelector('textarea')).toBeNull();});
 it('cleans up when the fallback throws',async()=>{install(null,()=>{throw new Error('denied');});expect(await copyTextToClipboard('ABC234')).toBe(false);expect(document.querySelector('textarea')).toBeNull();});
});
