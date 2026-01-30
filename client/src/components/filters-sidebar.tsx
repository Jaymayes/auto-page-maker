import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

interface Filters {
  amount?: string;
  deadline?: string;
  levels?: string[];
  isNoEssay?: boolean;
}

interface FiltersSidebarProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  'data-testid'?: string;
}

export default function FiltersSidebar({ 
  filters, 
  onFiltersChange,
  'data-testid': testId 
}: FiltersSidebarProps) {
  const [pendingFilters, setPendingFilters] = useState<Filters>(filters);

  const handleAmountChange = (value: string) => {
    setPendingFilters({
      ...pendingFilters,
      amount: value === "any" ? undefined : value
    });
  };

  const handleDeadlineChange = (value: string) => {
    setPendingFilters({
      ...pendingFilters,
      deadline: value === "any" ? undefined : value
    });
  };

  const handleLevelChange = (level: string, checked: boolean) => {
    const currentLevels = pendingFilters.levels || [];
    const newLevels = checked 
      ? Array.from(new Set([...currentLevels, level]))
      : currentLevels.filter(l => l !== level);
    
    setPendingFilters({
      ...pendingFilters,
      levels: newLevels.length > 0 ? newLevels : undefined
    });
  };

  const handleNoEssayChange = (checked: boolean) => {
    setPendingFilters({
      ...pendingFilters,
      isNoEssay: checked || undefined
    });
  };

  const handleApplyFilters = () => {
    onFiltersChange(pendingFilters);
  };

  const handleClearFilters = () => {
    setPendingFilters({});
    onFiltersChange({});
  };

  const hasActiveFilters = Object.values(pendingFilters).some(value => value !== undefined);

  return (
    <Card className="sticky top-8" data-testid={testId}>
      <CardContent className="p-6">
        <h3 className="font-semibold text-lg mb-4 text-gray-900">Filter Scholarships</h3>
        
        <div className="space-y-6">
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-2 block">
              Award Amount
            </Label>
            <Select 
              value={pendingFilters.amount || "any"} 
              onValueChange={handleAmountChange}
              data-testid="select-amount"
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Any Amount" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any Amount</SelectItem>
                <SelectItem value="1000">$1,000+</SelectItem>
                <SelectItem value="5000">$5,000+</SelectItem>
                <SelectItem value="10000">$10,000+</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-2 block">
              Application Deadline
            </Label>
            <Select 
              value={pendingFilters.deadline || "any"} 
              onValueChange={handleDeadlineChange}
              data-testid="select-deadline"
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Deadlines" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">All Deadlines</SelectItem>
                <SelectItem value="week">Due This Week</SelectItem>
                <SelectItem value="month">Due This Month</SelectItem>
                <SelectItem value="3months">Due in 3 Months</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-3 block">
              School Level
            </Label>
            <div className="space-y-3">
              {[
                { id: "undergraduate", label: "Undergraduate" },
                { id: "graduate", label: "Graduate" },
                { id: "high-school", label: "High School" }
              ].map((level) => (
                <div key={level.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={level.id}
                    checked={pendingFilters.levels?.includes(level.id) || false}
                    onCheckedChange={(checked) => handleLevelChange(level.id, checked as boolean)}
                    data-testid={`checkbox-${level.id}`}
                  />
                  <Label 
                    htmlFor={level.id}
                    className="text-sm text-gray-700 cursor-pointer"
                  >
                    {level.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium text-gray-700 mb-3 block">
              Application Type
            </Label>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="no-essay"
                checked={pendingFilters.isNoEssay || false}
                onCheckedChange={handleNoEssayChange}
                data-testid="checkbox-no-essay"
              />
              <Label 
                htmlFor="no-essay"
                className="text-sm text-gray-700 cursor-pointer"
              >
                No Essay Required
              </Label>
            </div>
          </div>
        </div>
        
        <div className="pt-6 space-y-2">
          <Button 
            className="w-full"
            disabled={!hasActiveFilters}
            onClick={handleApplyFilters}
            data-testid="button-apply-filters"
          >
            Apply Filters
          </Button>
          
          {hasActiveFilters && (
            <Button 
              variant="outline"
              className="w-full"
              onClick={handleClearFilters}
              data-testid="button-clear-filters"
            >
              Clear Filters
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
