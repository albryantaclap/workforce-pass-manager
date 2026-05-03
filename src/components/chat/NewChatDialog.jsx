import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import MultiSelect from '@/components/common/MultiSelect';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function NewChatDialog({
  open,
  onOpenChange,
  allUsers,
  currentUser,
  onCreateConversation,
}) {
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [chatType, setChatType] = useState('direct');

  const availableUsers = allUsers.filter(u => u.email !== currentUser?.email);

  const handleCreate = async () => {
    if (chatType === 'direct' && selectedUsers.length === 1) {
      await onCreateConversation('direct', null, [currentUser.email, selectedUsers[0]]);
    } else if (chatType === 'group' && selectedUsers.length > 0 && groupName.trim()) {
      await onCreateConversation('group', groupName, [currentUser.email, ...selectedUsers]);
    }
    setSelectedUsers([]);
    setGroupName('');
    onOpenChange(false);
  };

  const isValid =
    (chatType === 'direct' && selectedUsers.length === 1) ||
    (chatType === 'group' && selectedUsers.length > 0 && groupName.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Start a new chat</DialogTitle>
        </DialogHeader>

        <Tabs value={chatType} onValueChange={setChatType}>
          <TabsList className="w-full">
            <TabsTrigger value="direct" className="flex-1">Direct Message</TabsTrigger>
            <TabsTrigger value="group" className="flex-1">Group Chat</TabsTrigger>
          </TabsList>

          <TabsContent value="direct" className="space-y-4 mt-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">
                Select a user
              </label>
              <MultiSelect
                options={availableUsers.map(u => ({
                  value: u.email,
                  label: u.full_name || u.email,
                }))}
                value={selectedUsers}
                onChange={setSelectedUsers}
                placeholder="Choose user..."
                maxSelection={1}
              />
            </div>
          </TabsContent>

          <TabsContent value="group" className="space-y-4 mt-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">
                Group name
              </label>
              <Input
                placeholder="e.g., Engineering Team"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">
                Members (select at least 1)
              </label>
              <MultiSelect
                options={availableUsers.map(u => ({
                  value: u.email,
                  label: u.full_name || u.email,
                }))}
                value={selectedUsers}
                onChange={setSelectedUsers}
                placeholder="Add members..."
              />
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex gap-2 justify-end pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!isValid}>
            Create
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}