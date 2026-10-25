import {fireEvent,render,screen,cleanup} from '@testing-library/react';
import {afterEach,describe,it,expect,vi} from 'vitest';
import type {ReactNode} from 'react';
vi.mock('@tanstack/react-router',()=>({Link:({to,children,...props}:{to:string;children:ReactNode})=><a href={to} {...props}>{children}</a>}));
vi.mock('react-i18next',()=>({useTranslation:()=>({t:(key:string)=>({'me.profile':'Your profile','admin.platformGroup':'Platform administration','admin.dashboardLink':'Admin dashboard'}[key]??key)})}));
vi.mock('./gw-icon',()=>({GwIcon:()=>null}));
import {AccountMenu} from './account-menu';
afterEach(cleanup);
describe('Persistent account menu permissions',()=>{
 it('offers an admin return link when server-derived role is authorized',()=>{
  render(<AccountMenu initials="A" isAdmin />);fireEvent.keyDown(screen.getByRole('button'),{key:'Enter'});
  expect(screen.getByRole('menuitem',{name:'Admin dashboard'}).getAttribute('href')).toBe('/admin');
 });
 it('does not expose admin navigation to non-admins',()=>{
  render(<AccountMenu initials="M" isAdmin={false}/>);fireEvent.keyDown(screen.getByRole('button'),{key:'Enter'});
  expect(screen.queryByRole('menuitem',{name:'Admin dashboard'})).toBeNull();
  expect(screen.getByRole('menuitem',{name:'Your profile'}).getAttribute('href')).toBe('/me');
 });
});