// 이 파일은 `mcp__supabase__generate_typescript_types`의 산출물이다.
// 손으로 고치지 않는다 — 다음 생성에서 사라진다. 스키마를 바꿀 때마다 재생성한다.
//
// 주의: `api` 스키마가 여기 없다. MCP 생성기는 기본 스키마(`public`)만 내보내고
// 스키마를 고를 파라미터가 없다(CLI의 `--schema public,api`에 해당하는 옵션이 없다).
// 그래서 게스트 RPC 3개의 계약은 손으로 쓴 `types/moim.ts`에 둔다 — 역할 분리와도 맞다.
// 생성물은 DB 구조를, `moim.ts`는 화면과 RPC가 소비하는 형태를 담는다.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      event_notices: {
        Row: {
          body: string;
          created_at: string;
          event_id: string;
          id: string;
          is_pinned: boolean;
          updated_at: string;
        };
        Insert: {
          body: string;
          created_at?: string;
          event_id: string;
          id?: string;
          is_pinned?: boolean;
          updated_at?: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          event_id?: string;
          id?: string;
          is_pinned?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_notices_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      events: {
        Row: {
          bank_account: string | null;
          capacity: number | null;
          created_at: string;
          deleted_at: string | null;
          description: string | null;
          expected_headcount: number | null;
          host_id: string;
          id: string;
          location: string | null;
          maybe_deadline: string | null;
          rsvp_closes_at: string | null;
          share_expires_at: string | null;
          share_token: string;
          starts_at: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          bank_account?: string | null;
          capacity?: number | null;
          created_at?: string;
          deleted_at?: string | null;
          description?: string | null;
          expected_headcount?: number | null;
          host_id: string;
          id?: string;
          location?: string | null;
          maybe_deadline?: string | null;
          rsvp_closes_at?: string | null;
          share_expires_at?: string | null;
          share_token?: string;
          starts_at: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          bank_account?: string | null;
          capacity?: number | null;
          created_at?: string;
          deleted_at?: string | null;
          description?: string | null;
          expected_headcount?: number | null;
          host_id?: string;
          id?: string;
          location?: string | null;
          maybe_deadline?: string | null;
          rsvp_closes_at?: string | null;
          share_expires_at?: string | null;
          share_token?: string;
          starts_at?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      rsvp_changes: {
        Row: {
          changed_at: string;
          event_id: string;
          from_name: string | null;
          from_status: Database["public"]["Enums"]["rsvp_status"] | null;
          id: number;
          rsvp_id: string | null;
          to_name: string | null;
          to_status: Database["public"]["Enums"]["rsvp_status"];
        };
        Insert: {
          changed_at?: string;
          event_id: string;
          from_name?: string | null;
          from_status?: Database["public"]["Enums"]["rsvp_status"] | null;
          id?: never;
          rsvp_id?: string | null;
          to_name?: string | null;
          to_status: Database["public"]["Enums"]["rsvp_status"];
        };
        Update: {
          changed_at?: string;
          event_id?: string;
          from_name?: string | null;
          from_status?: Database["public"]["Enums"]["rsvp_status"] | null;
          id?: never;
          rsvp_id?: string | null;
          to_name?: string | null;
          to_status?: Database["public"]["Enums"]["rsvp_status"];
        };
        Relationships: [
          {
            foreignKeyName: "rsvp_changes_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rsvp_changes_rsvp_id_fkey";
            columns: ["rsvp_id"];
            isOneToOne: false;
            referencedRelation: "rsvps";
            referencedColumns: ["id"];
          },
        ];
      };
      rsvps: {
        Row: {
          display_name: string;
          event_id: string;
          guest_key: string;
          id: string;
          note: string | null;
          responded_at: string;
          status: Database["public"]["Enums"]["rsvp_status"];
          updated_at: string;
        };
        Insert: {
          display_name: string;
          event_id: string;
          guest_key: string;
          id?: string;
          note?: string | null;
          responded_at?: string;
          status: Database["public"]["Enums"]["rsvp_status"];
          updated_at?: string;
        };
        Update: {
          display_name?: string;
          event_id?: string;
          guest_key?: string;
          id?: string;
          note?: string | null;
          responded_at?: string;
          status?: Database["public"]["Enums"]["rsvp_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rsvps_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      settlement_items: {
        Row: {
          amount: number;
          created_at: string;
          id: string;
          label: string;
          settlement_id: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          id?: string;
          label: string;
          settlement_id: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          id?: string;
          label?: string;
          settlement_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "settlement_items_settlement_id_fkey";
            columns: ["settlement_id"];
            isOneToOne: false;
            referencedRelation: "settlements";
            referencedColumns: ["id"];
          },
        ];
      };
      settlement_shares: {
        Row: {
          amount: number;
          created_at: string;
          display_name: string;
          id: string;
          is_paid: boolean;
          paid_at: string | null;
          rsvp_id: string | null;
          settlement_id: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          display_name: string;
          id?: string;
          is_paid?: boolean;
          paid_at?: string | null;
          rsvp_id?: string | null;
          settlement_id: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          display_name?: string;
          id?: string;
          is_paid?: boolean;
          paid_at?: string | null;
          rsvp_id?: string | null;
          settlement_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "settlement_shares_rsvp_id_fkey";
            columns: ["rsvp_id"];
            isOneToOne: false;
            referencedRelation: "rsvps";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "settlement_shares_settlement_id_fkey";
            columns: ["settlement_id"];
            isOneToOne: false;
            referencedRelation: "settlements";
            referencedColumns: ["id"];
          },
        ];
      };
      settlements: {
        Row: {
          created_at: string;
          event_id: string;
          id: string;
          is_published: boolean;
          rounding_unit: number;
          snapshot_at: string | null;
        };
        Insert: {
          created_at?: string;
          event_id: string;
          id?: string;
          is_published?: boolean;
          rounding_unit?: number;
          snapshot_at?: string | null;
        };
        Update: {
          created_at?: string;
          event_id?: string;
          id?: string;
          is_published?: boolean;
          rounding_unit?: number;
          snapshot_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "settlements_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: true;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      generate_share_token: { Args: never; Returns: string };
      rebuild_settlement_shares: {
        Args: { p_amount: number; p_payers: Json; p_settlement_id: string };
        Returns: Json;
      };
      regenerate_share_token: { Args: { p_event_id: string }; Returns: string };
    };
    Enums: {
      rsvp_status: "attending" | "declined" | "maybe";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      rsvp_status: ["attending", "declined", "maybe"],
    },
  },
} as const;
