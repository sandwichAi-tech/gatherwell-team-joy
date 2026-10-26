import {fireEvent,render,screen,cleanup} from '@testing-library/react';
import {afterEach,describe,it,expect,vi} from 'vitest';
import type {ReactNode} from 'react';
vi.mock('@tanstack/react-router',()=>({Link:({to,children,...props}:{to:string;children:ReactNode})=><a href={to} {...props}>{children}</a>}));
vi.mock('react-i18next',()=>({useTranslation:()=>({t:(key:string)=>({'me.profile':'Your profile','admin.platformGroup':'Platform administration','admin.dashboardLink':'Admin dashboard','customerHome.switchAttending':'Switch to attending','customerHome.switchHost':'Switch to host'}[key]??key)})}));
vi.mock('./gw-icon',()=>({GwIcon:()=>null}));
const switchMode=vi.fn().mockResolvedValue(true);
vi.mock('@/lib/switch-mode',()=>({useSwitchMode:()=>switchMode}));
import {AccountMenu} from './account-menu';
afterEach(()=>{cleanup();switchMode.mockClear();});
describe('Persistent account menu permissions',()=>{
 it('offers an admin return link when server-derived role is authorized',()=>{
  render(<AccountMenu initials="A" isAdmin userId="u1" />);fireEvent.keyDown(screen.getByRole('button'),{key:'Enter'});
  expect(screen.getByRole('menuitem',{name:'Admin dashboard'}).getAttribute('href')).toBe('/admin');
 });
 it('does not expose admin navigation to non-admins',()=>{
  render(<AccountMenu initials="M" isAdmin={false} userId="u1" />);fireEvent.keyDown(screen.getByRole('button'),{key:'Enter'});
  expect(screen.queryByRole('menuitem',{name:'Admin dashboard'})).toBeNull();
  expect(screen.getByRole('menuitem',{name:'Your profile'}).getAttribute('href')).toBe('/me');
 });
});
describe('Account menu mode switch',()=>{
 it('offers Switch to attending to hosting accounts and runs the shared switch',()=>{
  render(<AccountMenu initials="H" isAdmin={false} userId="u1" canSwitchToAttending />);fireEvent.keyDown(screen.getByRole('button'),{key:'Enter'});
  fireEvent.click(screen.getByRole('menuitem',{name:'Switch to attending'}));
  expect(switchMode).toHaveBeenCalledWith('guest');
 });
 it('hides Switch to attending for accounts already attending',()=>{
  render(<AccountMenu initials="G" isAdmin={false} userId="u1" />);fireEvent.keyDown(screen.getByRole('button'),{key:'Enter'});
  expect(screen.queryByRole('menuitem',{name:'Switch to attending'})).toBeNull();
 });
  it('offers Switch to host to eligible attending hosts, separate from admin',()=>{
   render(<AccountMenu initials="H" isAdmin userId="u1" canSwitchToHost />);fireEvent.keyDown(screen.getByRole('button'),{key:'Enter'});
   expect(screen.getByRole('menuitem',{name:'Admin dashboard'})).toBeTruthy();
   fireEvent.click(screen.getByRole('menuitem',{name:'Switch to host'}));
   expect(switchMode).toHaveBeenCalledWith('host');
  });
  it('never shows Switch to host to attendee-only accounts',()=>{
   render(<AccountMenu initials="G" isAdmin={false} userId="u1" />);fireEvent.keyDown(screen.getByRole('button'),{key:'Enter'});
   expect(screen.queryByRole('menuitem',{name:'Switch to host'})).toBeNull();
  });
});
