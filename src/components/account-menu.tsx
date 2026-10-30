import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { GwIcon } from './gw-icon';
import { Button } from './ui/button';
import { useStartHosting, useSwitchMode } from '@/lib/switch-mode';
import { setViewAsUser, useViewAsUser } from '@/lib/feature-flags';
import { DropdownMenu,DropdownMenuTrigger,DropdownMenuContent,DropdownMenuItem,DropdownMenuLabel,DropdownMenuSeparator,DropdownMenuCheckboxItem } from './ui/dropdown-menu';
/** Mode switch lives with the profile; platform administration stays a separate group. */
export function AccountMenu({initials,isAdmin,userId,canSwitchToAttending = false,canSwitchToHost = false,canStartHosting = false}:{initials:string;isAdmin:boolean;userId:string;canSwitchToAttending?:boolean;canSwitchToHost?:boolean;canStartHosting?:boolean}){
 const {t}=useTranslation();
 const switchMode=useSwitchMode(userId);
 const startHosting=useStartHosting(userId);
 const viewAsUser=useViewAsUser();
 return <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" className="header-avatar" aria-label={t('me.profile')} title={t('me.profile')}>{initials}</Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem asChild><Link to="/me"><GwIcon name="UserRound" />{t('me.profile')}</Link></DropdownMenuItem>{canSwitchToAttending && <DropdownMenuItem onSelect={() => void switchMode('guest')}><GwIcon name="Compass" />{t('customerHome.switchAttending')}</DropdownMenuItem>}{canSwitchToHost && <DropdownMenuItem onSelect={() => void switchMode('host')}><GwIcon name="CalendarHeart" />{t('customerHome.switchHost')}</DropdownMenuItem>}{canStartHosting && <DropdownMenuItem onSelect={() => void startHosting()}><GwIcon name="Plus" />{t('customerHome.startHosting')}</DropdownMenuItem>}{isAdmin && <><DropdownMenuSeparator /><DropdownMenuLabel>{t('admin.platformGroup')}</DropdownMenuLabel><DropdownMenuItem asChild><Link to="/admin"><GwIcon name="ShieldCheck" />{t('admin.dashboardLink')}</Link></DropdownMenuItem><DropdownMenuCheckboxItem checked={viewAsUser} onCheckedChange={v => setViewAsUser(!!v)}>{t('viewAsUser.toggle')}</DropdownMenuCheckboxItem></>}</DropdownMenuContent></DropdownMenu>;
}
