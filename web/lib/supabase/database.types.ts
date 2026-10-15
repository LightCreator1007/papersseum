
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "admins": {
                  Row: {
                    "created_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"bot_name_aliases": {
                  Row: {
                    "bot_id": string,"created_at": string,"old_name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bot_id": string,"created_at"?: string,"old_name": string
                  }
                  Update: {
                    "bot_id"?: string,"created_at"?: string,"old_name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "bot_name_aliases_bot_id_fkey"
      columns: ["bot_id"]
isOneToOne: false
      referencedRelation: "bots"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bot_name_aliases_bot_id_fkey"
      columns: ["bot_id"]
isOneToOne: false
      referencedRelation: "leaderboard"
      referencedColumns: ["bot_id"]
    }
                  ]
                },"bots": {
                  Row: {
                    "active_since": string | null,"active_submission_id": string | null,"active_version": number | null,"banned": boolean,"created_at": string,"elo": number,"games": number,"id": string,"is_house": boolean,"name": string,"owner_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "active_since"?: string | null,"active_submission_id"?: string | null,"active_version"?: number | null,"banned"?: boolean,"created_at"?: string,"elo"?: number,"games"?: number,"id"?: string,"is_house"?: boolean,"name": string,"owner_id"?: string | null
                  }
                  Update: {
                    "active_since"?: string | null,"active_submission_id"?: string | null,"active_version"?: number | null,"banned"?: boolean,"created_at"?: string,"elo"?: number,"games"?: number,"id"?: string,"is_house"?: boolean,"name"?: string,"owner_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "bots_active_submission_fk"
      columns: ["active_submission_id"]
isOneToOne: false
      referencedRelation: "submissions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bots_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"jobs": {
                  Row: {
                    "attempts": number,"created_at": string,"finished_at": string | null,"id": number,"kind": Database["public"]['Enums']["job_kind"],"last_error": string | null,"lease_until": string | null,"match_id": number | null,"max_attempts": number,"priority": number,"status": Database["public"]['Enums']["job_status"],"submission_id": string | null,"worker_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"created_at"?: string,"finished_at"?: string | null,"id"?: never,"kind": Database["public"]['Enums']["job_kind"],"last_error"?: string | null,"lease_until"?: string | null,"match_id"?: number | null,"max_attempts"?: number,"priority"?: number,"status"?: Database["public"]['Enums']["job_status"],"submission_id"?: string | null,"worker_id"?: string | null
                  }
                  Update: {
                    "attempts"?: number,"created_at"?: string,"finished_at"?: string | null,"id"?: never,"kind"?: Database["public"]['Enums']["job_kind"],"last_error"?: string | null,"lease_until"?: string | null,"match_id"?: number | null,"max_attempts"?: number,"priority"?: number,"status"?: Database["public"]['Enums']["job_status"],"submission_id"?: string | null,"worker_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "jobs_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "jobs_submission_id_fkey"
      columns: ["submission_id"]
isOneToOne: false
      referencedRelation: "submissions"
      referencedColumns: ["id"]
    }
                  ]
                },"match_players": {
                  Row: {
                    "bot_id": string | null,"coverage": number | null,"crashed": boolean | null,"deaths": number | null,"elo_after": number | null,"elo_before": number | null,"match_id": number,"placement": number | null,"score": number | null,"slot": number,"strikes": number | null,"submission_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "bot_id"?: string | null,"coverage"?: number | null,"crashed"?: boolean | null,"deaths"?: number | null,"elo_after"?: number | null,"elo_before"?: number | null,"match_id": number,"placement"?: number | null,"score"?: number | null,"slot": number,"strikes"?: number | null,"submission_id"?: string | null
                  }
                  Update: {
                    "bot_id"?: string | null,"coverage"?: number | null,"crashed"?: boolean | null,"deaths"?: number | null,"elo_after"?: number | null,"elo_before"?: number | null,"match_id"?: number,"placement"?: number | null,"score"?: number | null,"slot"?: number,"strikes"?: number | null,"submission_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "match_players_bot_id_fkey"
      columns: ["bot_id"]
isOneToOne: false
      referencedRelation: "bots"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_players_bot_id_fkey"
      columns: ["bot_id"]
isOneToOne: false
      referencedRelation: "leaderboard"
      referencedColumns: ["bot_id"]
    },{
      foreignKeyName: "match_players_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_players_submission_id_fkey"
      columns: ["submission_id"]
isOneToOne: false
      referencedRelation: "submissions"
      referencedColumns: ["id"]
    }
                  ]
                },"matches": {
                  Row: {
                    "created_at": string,"engine_hash": string | null,"error": string | null,"finished_at": string | null,"id": number,"lobby_key": string | null,"replay_path": string | null,"round_id": number,"seed": number,"started_at": string | null,"status": Database["public"]['Enums']["match_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"engine_hash"?: string | null,"error"?: string | null,"finished_at"?: string | null,"id"?: never,"lobby_key"?: string | null,"replay_path"?: string | null,"round_id": number,"seed": number,"started_at"?: string | null,"status"?: Database["public"]['Enums']["match_status"]
                  }
                  Update: {
                    "created_at"?: string,"engine_hash"?: string | null,"error"?: string | null,"finished_at"?: string | null,"id"?: never,"lobby_key"?: string | null,"replay_path"?: string | null,"round_id"?: number,"seed"?: number,"started_at"?: string | null,"status"?: Database["public"]['Enums']["match_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "matches_round_id_fkey"
      columns: ["round_id"]
isOneToOne: false
      referencedRelation: "rounds"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"display_name": string | null,"handle": string,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name"?: string | null,"handle": string,"id": string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string | null,"handle"?: string,"id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"rounds": {
                  Row: {
                    "created_at": string,"id": number,"kind": Database["public"]['Enums']["round_kind"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: never,"kind"?: Database["public"]['Enums']["round_kind"]
                  }
                  Update: {
                    "created_at"?: string,"id"?: never,"kind"?: Database["public"]['Enums']["round_kind"]
                  }
                  Relationships: [
                    
                  ]
                },"season": {
                  Row: {
                    "allowed_email_domain": string | null,"engine_hash": string | null,"frozen": boolean,"games_per_round": number,"id": number,"matchmaking_noise": number,"max_backlog": number,"name": string,"repeat_window_rounds": number,"submission_cooldown": string
                  }
                  ComputedFields: never
                  Insert: {
                    "allowed_email_domain"?: string | null,"engine_hash"?: string | null,"frozen"?: boolean,"games_per_round"?: number,"id"?: number,"matchmaking_noise"?: number,"max_backlog"?: number,"name"?: string,"repeat_window_rounds"?: number,"submission_cooldown"?: string
                  }
                  Update: {
                    "allowed_email_domain"?: string | null,"engine_hash"?: string | null,"frozen"?: boolean,"games_per_round"?: number,"id"?: number,"matchmaking_noise"?: number,"max_backlog"?: number,"name"?: string,"repeat_window_rounds"?: number,"submission_cooldown"?: string
                  }
                  Relationships: [
                    
                  ]
                },"submissions": {
                  Row: {
                    "bot_id": string,"builtin": string | null,"created_at": string,"engine_hash": string | null,"error": string | null,"id": string,"sha256": string | null,"size_bytes": number | null,"status": Database["public"]['Enums']["submission_status"],"storage_path": string | null,"validated_at": string | null,"version": number,"violations": Json | null
                  }
                  ComputedFields: never
                  Insert: {
                    "bot_id": string,"builtin"?: string | null,"created_at"?: string,"engine_hash"?: string | null,"error"?: string | null,"id"?: string,"sha256"?: string | null,"size_bytes"?: number | null,"status"?: Database["public"]['Enums']["submission_status"],"storage_path"?: string | null,"validated_at"?: string | null,"version": number,"violations"?: Json | null
                  }
                  Update: {
                    "bot_id"?: string,"builtin"?: string | null,"created_at"?: string,"engine_hash"?: string | null,"error"?: string | null,"id"?: string,"sha256"?: string | null,"size_bytes"?: number | null,"status"?: Database["public"]['Enums']["submission_status"],"storage_path"?: string | null,"validated_at"?: string | null,"version"?: number,"violations"?: Json | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "submissions_bot_id_fkey"
      columns: ["bot_id"]
isOneToOne: false
      referencedRelation: "bots"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "submissions_bot_id_fkey"
      columns: ["bot_id"]
isOneToOne: false
      referencedRelation: "leaderboard"
      referencedColumns: ["bot_id"]
    }
                  ]
                },"workers": {
                  Row: {
                    "current_job": number | null,"engine_hash": string | null,"id": string,"last_seen": string,"version": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "current_job"?: number | null,"engine_hash"?: string | null,"id": string,"last_seen"?: string,"version"?: string | null
                  }
                  Update: {
                    "current_job"?: number | null,"engine_hash"?: string | null,"id"?: string,"last_seen"?: string,"version"?: string | null
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "leaderboard": {
                  Row: {
                    "active_since": string | null,"active_version": number | null,"bot_id": string | null,"conservative": number | null,"elo": number | null,"games": number | null,"handle": string | null,"is_house": boolean | null,"name": string | null,"owner_name": string | null,"rank": number | null,"sigma": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "api_create_submission":
{ Args: { "p_sha256": string,"p_size_bytes": number,"p_storage_path": string,"p_submission_id": string,"p_user_id": string }; Returns: {
              "bot_id": string,
"builtin": string | null,
"created_at": string,
"engine_hash": string | null,
"error": string | null,
"id": string,
"sha256": string | null,
"size_bytes": number | null,
"status": Database["public"]['Enums']["submission_status"],
"storage_path": string | null,
"validated_at": string | null,
"version": number,
"violations": Json | null
            }
                          SetofOptions: {
        from: "*"
        to: "submissions"
        isOneToOne: true
        isSetofReturn: false
      } },
"rename_bot":
{ Args: { "p_new_name": string }; Returns: {
              "name": string
            }[]
                           },
"resolve_bot_name":
{ Args: { "p_name": string }; Returns: string
                           }
          }
          Enums: {
            "job_kind": "validate"|"match","job_status": "queued"|"running"|"done"|"failed","match_status": "queued"|"running"|"done"|"failed","round_kind": "ladder"|"final","submission_status": "pending"|"validating"|"active"|"rejected"|"superseded"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "job_kind": ["validate", "match"],"job_status": ["queued", "running", "done", "failed"],"match_status": ["queued", "running", "done", "failed"],"round_kind": ["ladder", "final"],"submission_status": ["pending", "validating", "active", "rejected", "superseded"]
          }
        }
} as const
