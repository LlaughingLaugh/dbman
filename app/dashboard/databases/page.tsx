'use client';

import { useState, FormEvent } from 'react';
import { Input } from '@/components/ui/input'; // Assuming Shadcn UI setup
import { Button } from '@/components/ui/button'; // Assuming Shadcn UI setup
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card'; // Assuming Shadcn UI setup
import { connectToDatabaseAndListTables, ConnectResult } from './actions'; // Server action

interface ConnectedDBInfo {
  id: string; // Unique ID for list key, can be same as path for simplicity here
  path: string;
  tables: string[];
  error?: string;
}

export default function DatabaseManagementPage() {
  const [dbFileName, setDbFileName] = useState<string>('');
  const [connectedDatabases, setConnectedDatabases] = useState<ConnectedDBInfo[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [generalError, setGeneralError] = useState<string>('');

  const handleConnect = async (event: FormEvent) => {
    event.preventDefault();
    if (!dbFileName.trim()) {
      setGeneralError('Please enter a database file name.');
      return;
    }

    // Prevent duplicate connections to the same file path in this client-side list
    if (connectedDatabases.some(db => db.path === dbFileName)) {
      setGeneralError(`Database '${dbFileName}' is already in the list.`);
      return;
    }

    setIsLoading(true);
    setGeneralError('');

    try {
      const result: ConnectResult = await connectToDatabaseAndListTables(dbFileName);

      if (result.success) {
        setConnectedDatabases(prev => [
          ...prev,
          { id: result.path, path: result.path, tables: result.tables || [], error: undefined },
        ]);
        setDbFileName(''); // Clear input after successful connection
      } else {
        // Display error for this specific connection attempt, could also add to a list of attempts
        setGeneralError(result.error || `Failed to connect to ${result.path}.`);
        // Optionally, add it to the list with an error state if you want to show failed connection cards
        // setConnectedDatabases(prev => [
        //   ...prev,
        //   { id: result.path, path: result.path, tables: [], error: result.error || 'Failed to connect' },
        // ]);
      }
    } catch (error: any) {
      console.error('Connection error:', error);
      setGeneralError(error.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = (dbPathToDisconnect: string) => {
    setConnectedDatabases(prev => prev.filter(db => db.path !== dbPathToDisconnect));
  };

  return (
    <div className="container mx-auto p-4 space-y-8">
      <header className="text-center">
        <h1 className="text-3xl font-bold">Database Management</h1>
        <p className="text-muted-foreground">Connect to and manage your SQLite databases.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Connect to a Database</CardTitle>
          <CardDescription>
            Enter the name of your SQLite database file (e.g., `mydb.sqlite`).
            It will be accessed from a predefined server directory (`data/`).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleConnect} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="dbPath" className="block text-sm font-medium">Database File Name</label>
              <Input
                id="dbPath"
                type="text"
                value={dbFileName}
                onChange={(e) => setDbFileName(e.target.value)}
                placeholder="e.g., mydatabase.sqlite"
                disabled={isLoading}
                className="max-w-md"
              />
            </div>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Connecting...' : 'Connect'}
            </Button>
            {generalError && <p className="text-sm text-destructive">{generalError}</p>}
          </form>
        </CardContent>
      </Card>

      {connectedDatabases.length > 0 && (
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-center">Connected Databases</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {connectedDatabases.map((db) => (
              <Card key={db.id} className="flex flex-col">
                <CardHeader>
                  <CardTitle className="truncate" title={db.path}>{db.path}</CardTitle>
                  {db.error && <CardDescription className="text-destructive">{db.error}</CardDescription>}
                </CardHeader>
                <CardContent className="flex-grow space-y-2">
                  {!db.error && (
                    <>
                      <h4 className="font-medium">Tables:</h4>
                      {db.tables.length > 0 ? (
                        <ul className="list-disc list-inside text-sm space-y-1 max-h-40 overflow-y-auto">
                          {db.tables.map((table) => (
                            <li key={table}>{table}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground">No tables found.</p>
                      )}
                    </>
                  )}
                </CardContent>
                <CardFooter>
                  <Button
                    variant="outline"
                    onClick={() => handleDisconnect(db.path)}
                    className="w-full"
                    disabled={isLoading} // Disable if global loading is active
                  >
                    Disconnect
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
