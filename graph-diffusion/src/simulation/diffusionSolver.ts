import type { DiffusionParams, FunctionValues, Graph } from "../types";
import * as math from "mathjs";
import type { Matrix } from "mathjs";
export interface solutionState {
    currentValues: FunctionValues;
    previousValues?: FunctionValues;
    edgeFluxValues: Map<number, number>;
    time: number;
    timeStepCount: number;
}

export class DiffusionSolver {
    private graph: Graph;
    private params: DiffusionParams;
    private readonly initialValues: FunctionValues;
    private state: solutionState;
    private lhsMatrix: Matrix  // LHS matrix for BDF2 solve: (I + 2/3*h*D*L)
    
    constructor(graph: Graph, params: DiffusionParams) {
        this.graph = graph;
        this.params = params;
        this.initialValues = new Map(params.initialValues);
        this.state = {
            currentValues: new Map(this.initialValues),
            previousValues: new Map(this.initialValues),
            edgeFluxValues: this.computeEdgeFluxValues(new Map(this.initialValues)),
            time: 0,
            timeStepCount: 0
        };
        this.lhsMatrix = this.computeLHS();
    }

    private toFiniteNumber(value: unknown, fallback = 0): number {
        if (typeof value === "number" && Number.isFinite(value)) {
            return value;
        }
        if (Array.isArray(value) && value.length > 0) {
            return this.toFiniteNumber(value[0], fallback);
        }
        return fallback;
    }

    private toSolutionVector(solution: Matrix | number[] | number[][]): number[] {
        const raw = (Array.isArray(solution) ? solution : solution.toArray()) as Array<number | number[]>;
        return raw.map((entry) => this.toFiniteNumber(entry, 0));
    }

    private computeEdgeFluxValues(vertexValues: FunctionValues): Map<number, number> {
        const D = this.params.diffusionRate;
        const edgeFluxValues = new Map<number, number>();

        for (const edge of this.graph.edges) {
            const u1 = this.toFiniteNumber(vertexValues.get(edge.v1), 0);
            const u2 = this.toFiniteNumber(vertexValues.get(edge.v2), 0);
            const edgeLength = edge.length ?? 1;

            // Signed flux follows edge orientation v1 -> v2.
            const flux = D * (u1 - u2) / edgeLength;
            edgeFluxValues.set(edge.index, flux);
        }

        return edgeFluxValues;
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
        const uCurrentArray = this.graph.vertices.map(v => this.toFiniteNumber(this.state.currentValues.get(v.index), 0));
        
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
            
            const uNext = math.lusolve(lhs, uCurrentArray) as Matrix | number[] | number[][];
            uNextArray = this.toSolutionVector(uNext);
        } else {
            // BDF2
            const uPreviousArray = this.graph.vertices.map(v => this.toFiniteNumber(this.state.previousValues!.get(v.index), 0));
            
            // RHS = 4/3 * u_n - 1/3 * u_{n-1}
            const rhs = uCurrentArray.map((u, i) => (4/3) * u - (1/3) * uPreviousArray[i]);
            
            const uNext = math.lusolve(this.lhsMatrix, rhs) as Matrix | number[] | number[][];
            uNextArray = this.toSolutionVector(uNext);
        }

        // Update state
        this.state.previousValues = new Map(this.state.currentValues);
        this.state.currentValues = new Map(
            this.graph.vertices.map((v, i) => [v.index, uNextArray[i]])
        );
        this.state.edgeFluxValues = this.computeEdgeFluxValues(this.state.currentValues);

        this.state.time += this.params.timeStep;
        this.state.timeStepCount += 1;
    }

    public reset(): void {
        this.state.currentValues = new Map(this.initialValues);
        this.state.previousValues = new Map(this.initialValues);
        this.state.edgeFluxValues = this.computeEdgeFluxValues(this.state.currentValues);
        this.state.time = 0;
        this.state.timeStepCount = 0;
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
