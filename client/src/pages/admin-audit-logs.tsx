import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { useLocation } from "wouter";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Search, Filter, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface BusinessEvent {
  id: string;
  requestId: string;
  app: string;
  env: string;
  eventName: string;
  ts: string;
  actorType: string | null;
  actorId: string | null;
  orgId: string | null;
  sessionId: string | null;
  properties: Record<string, any>;
  createdAt: string;
}

export default function AdminAuditLogs() {
  const [appFilter, setAppFilter] = useState<string>("");
  const [eventNameFilter, setEventNameFilter] = useState<string>("");
  const [limitFilter, setLimitFilter] = useState<string>("100");
  const [, setLocation] = useLocation();

  // Check authentication status
  const { data: user, isLoading: isAuthLoading, error: authError } = useQuery({
    queryKey: ['/api/auth/user'],
    retry: false,
  });

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthLoading && (authError || !user)) {
      // User not authenticated, redirect to register/login
      setLocation('/register');
    }
  }, [user, isAuthLoading, authError, setLocation]);

  const { data: events, isLoading, refetch, error } = useQuery<BusinessEvent[]>({
    queryKey: ['/api/business-events', appFilter, eventNameFilter, limitFilter],
    enabled: !!user, // Only fetch events if user is authenticated
  });

  // Show loading state while checking auth
  if (isAuthLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">Verifying authentication...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show error if not authenticated (before redirect completes)
  if (!user) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Authentication Required</AlertTitle>
          <AlertDescription>
            You must be logged in to view audit logs. Please{' '}
            <a href="/register" className="underline font-medium">sign in or register</a>.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const uniqueApps = events ? Array.from(new Set(events.map(e => e.app))) : [];
  const uniqueEventNames = events ? Array.from(new Set(events.map(e => e.eventName))) : [];

  const getEventBadgeColor = (eventName: string): string => {
    if (eventName.includes('error') || eventName.includes('failed')) return 'destructive';
    if (eventName.includes('success') || eventName.includes('completed') || eventName.includes('posted')) return 'default';
    if (eventName.includes('started') || eventName.includes('pending')) return 'secondary';
    return 'outline';
  };

  const getActorBadgeColor = (actorType: string | null): string => {
    switch (actorType) {
      case 'system': return 'secondary';
      case 'provider': return 'default';
      case 'student': return 'outline';
      default: return 'outline';
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="heading-audit-logs">
          <FileText className="h-8 w-8" />
          Audit Logs
        </h1>
        <p className="text-muted-foreground mt-2">
          Business events telemetry across all applications
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
          <CardDescription>
            Filter audit logs by application, event name, and limit
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Application</label>
              <Select value={appFilter} onValueChange={setAppFilter}>
                <SelectTrigger data-testid="select-app-filter">
                  <SelectValue placeholder="All apps" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All apps</SelectItem>
                  {uniqueApps.map(app => (
                    <SelectItem key={app} value={app}>{app}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Event Name</label>
              <Select value={eventNameFilter} onValueChange={setEventNameFilter}>
                <SelectTrigger data-testid="select-event-filter">
                  <SelectValue placeholder="All events" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All events</SelectItem>
                  {uniqueEventNames.map(name => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Limit</label>
              <Input 
                type="number" 
                value={limitFilter} 
                onChange={(e) => setLimitFilter(e.target.value)}
                placeholder="100"
                min="1"
                max="1000"
                data-testid="input-limit"
              />
            </div>

            <div className="flex items-end">
              <Button 
                onClick={() => refetch()} 
                className="w-full"
                data-testid="button-refresh"
              >
                <Search className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Card>
          <CardContent className="py-12">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Access Denied</AlertTitle>
              <AlertDescription>
                You do not have permission to view audit logs. This feature requires admin privileges.
                {' '}Contact your system administrator if you believe you should have access.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">Loading audit logs...</div>
          </CardContent>
        </Card>
      ) : events && events.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle data-testid="text-event-count">
              {events.length} Event{events.length !== 1 ? 's' : ''}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>App</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Request ID</TableHead>
                    <TableHead>Properties</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((event) => (
                    <TableRow key={event.id} data-testid={`row-event-${event.id}`}>
                      <TableCell className="font-mono text-xs" data-testid={`text-timestamp-${event.id}`}>
                        {format(new Date(event.ts), 'yyyy-MM-dd HH:mm:ss')}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" data-testid={`badge-app-${event.id}`}>
                          {event.app}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getEventBadgeColor(event.eventName) as any} data-testid={`badge-event-${event.id}`}>
                          {event.eventName}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {event.actorType ? (
                          <div className="space-y-1">
                            <Badge variant={getActorBadgeColor(event.actorType) as any}>
                              {event.actorType}
                            </Badge>
                            {event.actorId && (
                              <div className="font-mono text-xs text-muted-foreground">
                                {event.actorId.substring(0, 12)}...
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs" data-testid={`text-request-${event.id}`}>
                        {event.requestId.substring(0, 8)}...
                      </TableCell>
                      <TableCell>
                        <details className="cursor-pointer">
                          <summary className="text-sm text-muted-foreground hover:text-foreground">
                            {Object.keys(event.properties).length} field(s)
                          </summary>
                          <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-x-auto max-w-md">
                            {JSON.stringify(event.properties, null, 2)}
                          </pre>
                        </details>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              No events found matching the current filters
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
