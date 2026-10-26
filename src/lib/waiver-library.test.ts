import { describe,it,expect } from 'vitest';
import { libraryTextValid,selectedWaiverVersion } from './waiver-library';
describe('reusable waiver rules',()=>{
  it('requires name and readable English text',()=>{expect(libraryTextValid('Waiver','','')).toBe(false);expect(libraryTextValid('','Text','')).toBe(false);expect(libraryTextValid('Waiver','Text','')).toBe(true);});
  it('limits text to 12000 characters',()=>{expect(libraryTextValid('Waiver','a'.repeat(12000),'')).toBe(true);expect(libraryTextValid('Waiver','a'.repeat(12001),'')).toBe(false);});
  it('retains attached version one after library version two',()=>expect(selectedWaiverVersion(1,2)).toBe(1));
});