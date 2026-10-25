import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { coachRequestSchema, coachUpdatesOrigin } from './coach-updates';
export const coachUpdatesSetup = createServerFn({method:'GET'}).handler(async()=> {
 const {channelStatus}=await import('./notify/channels.server');const status=channelStatus();
 return {confirmation:status.email,delivery:status.announcements};
});
export const requestCoachUpdates = createServerFn({method:'POST'})
 .inputValidator((v:unknown)=>coachRequestSchema.parse(v))
 .handler(async({data})=>{
  const {channelStatus}=await import('./notify/channels.server');const s=channelStatus();
  const origin=coachUpdatesOrigin(data.origin);
  const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
  const {error}=await supabaseAdmin.rpc('request_coach_updates',{_slug:data.slug,_email:data.email,_language:data.language,_announcements:data.announcements,_events:data.events,_resources:data.resources,_adult:data.adult,_base:origin,_send_confirmation:s.email});
  if(error)throw new Error(error.message);return {ok:true,reason:s.email?'confirmation_pending':'confirmation_unavailable'};
 });
export const subscriberSegments = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
 const {data,error}=await context.supabase.rpc('coach_subscriber_segments');if(error)throw new Error(error.message);return data as {confirmed:number;announcements:number;new_events:number;new_resources:number};
});