'use client';

import { useState, FormEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableCaption,
} from '@/components/ui/table';
import {
  getOverallStatsAction,
  InsightStats,
  DatabaseInsight,
  TableInfo, // Ensure these types are exported from actions.ts or defined here
  GetOverallStatsResult
} from './actions';
import { Loader2 } from 'lucide-react';

export default function InsightsPage() {
  const [dbFileNamesInput, setDbFileNamesInput] = useState<string>('');
  const [stats, setStats] = useState<InsightStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateInsights = async (event: FormEvent) => {
    event.preventDefault();
    if (!dbFileNamesInput.trim()) {
      setError('Please enter at least one database file name.');
      setStats(null);
      return;
    }

    const fileNames = dbFileNamesInput.split(',').map(name => name.trim()).filter(name => name.length > 0);

    if (fileNames.length === 0) {
      setError('No valid database file names provided.');
      setStats(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    setStats(null);

    const result: GetOverallStatsResult = await getOverallStatsAction(fileNames);

    if (result.success && result.stats) {
      setStats(result.stats);
    } else {
      setError(result.error || 'Failed to generate insights.');
    }
    setIsLoading(false);
  };

  const getTopLargestTables = (): (TableInfo & { databaseFile: string })[] => {
    if (!stats) return [];
    const allTables: (TableInfo & { databaseFile: string })[] = [];
    stats.databases.forEach(db => {
      if (!db.error) { // Only consider successfully processed databases
        db.tables.forEach(table => {
          allTables.push({ ...table, databaseFile: db.fileName });
        });
      }
    });
    return allTables.sort((a, b) => b.rowCount - a.rowCount).slice(0, 5);
  };
  
  const topTables = getTopLargestTables();

  return (
    <div className="container mx-auto p-4 space-y-8">
      <header className="text-center">
        <h1 className="text-3xl font-bold">Dashboard Insights</h1>
        <p className="text-muted-foreground">Generate and view statistics across your SQLite databases.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Generate Database Insights</CardTitle>
          <CardDescription>
            Enter comma-separated database file names (e.g., `db1.sqlite, db2.sqlite`).
            These files are expected to be in the server's `data/` directory.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleGenerateInsights} className="space-y-4">
            <Input
              type="text"
              value={dbFileNamesInput}
              onChange={(e) => setDbFileNamesInput(e.target.value)}
              placeholder="e.g., mydatabase.sqlite, another.db"
              disabled={isLoading}
              className="max-w-lg"
            />
            <Button type="submit" disabled={isLoading}>
              {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</> : 'Generate Insights'}
            </Button>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </form>
        </CardContent>
      </Card>

      {stats && (
        <div className="space-y-8">
          {/* Overall Summary */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-center">Overall Summary</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              <Card>
                <CardHeader>
                  <CardTitle>{stats.totalDatabasesSuccessfullyProcessed} / {stats.totalDatabasesProcessed}</CardTitle>
                  <CardDescription>Databases Processed (Successfully / Total)</CardDescription>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>{stats.totalTables}</CardTitle>
                  <CardDescription>Total Tables (in successfully processed DBs)</CardDescription>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>{stats.grandTotalRows.toLocaleString()}</CardTitle>
                  <CardDescription>Grand Total Rows (in successfully processed DBs)</CardDescription>
                </CardHeader>
              </Card>
            </div>
          </section>

          {/* Top 5 Largest Tables */}
          {topTables.length > 0 && (
             <section>
                <h2 className="text-2xl font-semibold mb-4">Top 5 Largest Tables (Across All Processed Databases)</h2>
                <Card>
                    <CardContent className="pt-6"> {/* Added padding top for content inside card */}
                        <Table>
                            <TableHeader>
                            <TableRow>
                                <TableHead>Table Name</TableHead>
                                <TableHead>Database File</TableHead>
                                <TableHead className="text-right">Row Count</TableHead>
                            </TableRow>
                            </TableHeader>
                            <TableBody>
                            {topTables.map((table, index) => (
                                <TableRow key={index}>
                                <TableCell>{table.name}</TableCell>
                                <TableCell>{table.databaseFile}</TableCell>
                                <TableCell className="text-right">{table.rowCount.toLocaleString()}</TableCell>
                                </TableRow>
                            ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </section>
          )}

          {/* Per-Database Statistics */}
          <section className="space-y-6">
            <h2 className="text-2xl font-semibold mb-4 text-center">Per-Database Statistics</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {stats.databases.map((db, index) => (
                <Card key={index} className="flex flex-col">
                  <CardHeader>
                    <CardTitle className="truncate" title={db.fileName}>{db.fileName}</CardTitle>
                    {db.error && <CardDescription className="text-sm text-destructive">Error: {db.error}</CardDescription>}
                  </CardHeader>
                  {!db.error && (
                    <>
                      <CardContent className="flex-grow space-y-2">
                        <p className="text-sm"><strong>Tables:</strong> {db.tableCount}</p>
                        <p className="text-sm"><strong>Total Rows:</strong> {db.totalRows.toLocaleString()}</p>
                        {db.tables.length > 0 && (
                          <div className="pt-2">
                            <h4 className="font-medium text-sm mb-1">Table Details:</h4>
                            <div className="max-h-48 overflow-y-auto border rounded-md">
                              <Table>
                                <TableHeader className="sticky top-0 bg-muted/50">
                                  <TableRow>
                                    <TableHead className="text-xs px-2 py-1 h-auto">Name</TableHead>
                                    <TableHead className="text-right text-xs px-2 py-1 h-auto">Rows</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {db.tables.sort((a,b) => b.rowCount - a.rowCount).map((table) => (
                                    <TableRow key={table.name}>
                                      <TableCell className="text-xs px-2 py-1">{table.name}</TableCell>
                                      <TableCell className="text-right text-xs px-2 py-1">{table.rowCount.toLocaleString()}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </>
                  )}
                </Card>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
