import type { DiffusionParams, FunctionValues, Graph } from "../types";
import * as math from "mathjs";
import type { Matrix } from "mathjs";
export interface solutionState {
    currentValues: FunctionValues;
    previousValues?: FunctionValues;
    time: number;
    timeStepCount: number;
}

export class DiffusionSolver {
    private graph: Graph;
    private params: DiffusionParams;
    private state: solutionState;
    private lhsMatrix: Matrix  // LHS matrix for BDF2 solve: (I + 2/3*h*D*L)
    
    constructor(graph: Graph, params: DiffusionParams) {
        this.graph = graph;
        this.params = params;
        this.state = {
            currentValues: new Map(params.initialValues),
            previousValues: new Map(params.initialValues),
            time: 0,
            timeStepCount: 0
        };
        this.lhsMatrix = this.computeLHS();
    }

    private computeLHS(): Matrix {
        const numVertices = this.graph.vertices.length;
        const numEdges = this.graph.edges.length;

        // incidence matrix B (numVertices x numEdges)
        const B = Array.from({ length: numVertices }, () => Array(numEdges).fill(0));
        for (const edge of this.graph.edges) {
            B[edge.v1][edge.index] = 1;
            B[edge.v2][edge.index] = -1;
        }

        // weight matrix W (numEdges x numEdges)
        const weights = this.graph.edges.map(edge => 1 / (edge.length ?? 1));
        const W = math.diag(weights);

        // Laplacian L = B * W * B^T
        const BW = math.multiply(B, W);
        const L = math.multiply(BW, math.transpose(B)) as Matrix;

        // Diffusion: du/dt = -D*L*u, so BDF2 LHS is (I + 2/3*h*D*L)
        const h = this.params.timeStep;
        const D = this.params.diffusionRate;
        return math.add(math.identity(numVertices), math.multiply((2/3) * h * D, L)) as Matrix;
    }

    public timestep(): void {
        const uCurrentArray = this.graph.vertices.map(v => this.state.currentValues.get(v.index) ?? 0);
        
        let uNextArray: number[];
        
        if (this.state.timeStepCount === 0) {
            // First step: implicit Euler
            const L = this.computeLaplacian();
            const h = this.params.timeStep;
            const D = this.params.diffusionRate;
            const numVertices = this.graph.vertices.length;
            
            // Diffusion: du/dt = -D*L*u, so implicit Euler LHS is (I + h*D*L)
            const lhs = math.add(
                math.identity(numVertices),
                math.multiply(h * D, L)
            ) as Matrix;
            
            const uNext = math.lusolve(lhs, uCurrentArray);
            uNextArray = (Array.isArray(uNext) ? uNext : (uNext as Matrix).toArray() as number[]);
            
            console.log(`[Step 0] Initial u:`, uCurrentArray);
            console.log(`[Step 0] After Euler u:`, uNextArray);
        } else {
            // BDF2
            const uPreviousArray = this.graph.vertices.map(v => this.state.previousValues!.get(v.index) ?? 0);
            
            // RHS = 4/3 * u_n - 1/3 * u_{n-1}
            const rhs = uCurrentArray.map((u, i) => (4/3) * u - (1/3) * uPreviousArray[i]);
            
            const uNext = math.lusolve(this.lhsMatrix, rhs);
            uNextArray = (Array.isArray(uNext) ? uNext : (uNext as Matrix).toArray() as number[]);
            
            if (this.state.timeStepCount % 10 === 1) {
                console.log(`[Step ${this.state.timeStepCount}] u_n:`, uCurrentArray.slice(0, 3));
                console.log(`[Step ${this.state.timeStepCount}] u_n-1:`, uPreviousArray.slice(0, 3));
                console.log(`[Step ${this.state.timeStepCount}] RHS:`, rhs.slice(0, 3));
                console.log(`[Step ${this.state.timeStepCount}] u_next:`, uNextArray.slice(0, 3));
            }
        }

        // Update state
        this.state.previousValues = new Map(this.state.currentValues);
        this.state.currentValues = new Map(
            this.graph.vertices.map((v, i) => [v.index, uNextArray[i]])
        );

        this.state.time += this.params.timeStep;
        this.state.timeStepCount += 1;
    }

    private computeLaplacian(): Matrix {
        const numVertices = this.graph.vertices.length;
        const numEdges = this.graph.edges.length;
        const B = Array.from({ length: numVertices }, () => Array(numEdges).fill(0));
        for (const edge of this.graph.edges) {
            B[edge.v1][edge.index] = 1;
            B[edge.v2][edge.index] = -1;
        }
        const weights = this.graph.edges.map(edge => 1 / (edge.length ?? 1));
        const W = math.diag(weights);
        const BW = math.multiply(B, W);
        return math.multiply(BW, math.transpose(B)) as Matrix;
    }

    public getState(): solutionState {
        return this.state;
    }
}
