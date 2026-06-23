import { useState } from "react";
import { Users, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/user-menu";
import { BrandLogo } from "@/components/brand-logo";
import { CreateGroupDialog } from "@/components/create-group-dialog";

export default function Onboarding() {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex justify-between items-center px-6 pt-6 pb-2 text-foreground">
        <BrandLogo className="h-8 sm:h-9" />
        <UserMenu />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[36rem] h-72 bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="z-10 w-full max-w-md text-center space-y-6">
          <Users className="w-12 h-12 text-primary mx-auto" />
          <div className="space-y-2">
            <h1 className="text-4xl font-serif tracking-wide">
              Start a group
            </h1>
            <p className="text-muted-foreground">
              Groups are how you share your watch library with friends and
              family. Create one to get going — then invite people with a link.
              You can join more groups anytime.
            </p>
          </div>
          <Button
            size="lg"
            className="rounded-full"
            onClick={() => setCreateOpen(true)}
            data-testid="button-onboarding-create"
          >
            <Plus className="w-5 h-5 mr-2" />
            Create your first group
          </Button>
          <p className="text-sm text-muted-foreground">
            Got an invite link from a friend? Just open it to join their group.
          </p>
        </div>
      </div>

      <CreateGroupDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
