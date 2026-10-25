import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { GwIcon } from './gw-icon';
import { Button } from './ui/button';
import { DropdownMenu,DropdownMenuTrigger,DropdownMenuContent,DropdownMenuItem,DropdownMenuLabel,DropdownMenuSeparator } from './ui/dropdown-menu';
export function AccountMenu({initials,isAdmin}:{initials:string;isAdmin:boolean}){
 const {t}=useTranslation();
 return <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" className="header-avatar" aria-label={t('me.profile')} title={t('me.profile')}>{initials}</Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem asChild><Link to="/me"><GwIcon name="UserRound" />{t('me.profile')}</Link></DropdownMenuItem>{isAdmin && <><DropdownMenuSeparator /><DropdownMenuLabel>{t('admin.platformGroup')}</DropdownMenuLabel><DropdownMenuItem asChild><Link to="/admin"><GwIcon name="ShieldCheck" />{t('admin.dashboardLink')}</Link></DropdownMenuItem></>}</DropdownMenuContent></DropdownMenu>;
}