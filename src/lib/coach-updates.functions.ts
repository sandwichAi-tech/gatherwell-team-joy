import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
const preferences = z.object({announcements:z.boolean(),events:z.boolean(),resources:z.boolean()});
export const coachUpdatesSetup = createServerFn({method:'GET'}).handler(async()=> {
 const {channelStatus}=await import('./notify/channels.server');const status=channelStatus();
 return {confirmation:status.email,delivery:status.announcements};
});
export const requestCoachUpdates = createServerFn({method:'POST'})
 .inputValidator((v:unknown)=>preferences.extend({slug:z.string().min(3).max(80),email:z.string().email().max(254),language:z.enum(['en','es']),adult:z.literal(true),origin:z.string().url()}).parse(v))
 .handler(async({data})=>{
  const {channelStatus}=await import('./notify/channels.server');const s=channelStatus();
  if(!s.email||!s.announcements)return {ok:false,reason:'setup_required'};
  const url=new URL(data.origin);
  if(url.protocol!=='https:' && url.origin!=='http://localhost:8080')throw new Error('invalid_origin');
  if(!['zoheewell.com','www.zoheewell.com','localhost'].includes(url.hostname)&&!url.hostname.endsWith('.lovable.app'))throw new Error('invalid_origin');
  const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
  const {error}=await supabaseAdmin.rpc('request_coach_updates',{_slug:data.slug,_email:data.email,_language:data.language,_announcements:data.announcements,_events:data.events,_resources:data.resources,_adult:data.adult,_base:url.origin});
  if(error)throw new Error(error.message);return {ok:true,reason:'confirmation_pending'};
 });
export const subscriberSegments = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
 const {data,error}=await context.supabase.rpc('coach_subscriber_segments');if(error)throw new Error(error.message);return data as {confirmed:number;announcements:number;new_events:number;new_resources:number};
});